/**
 * VerificaAI — Proteção contra SSRF (Server-Side Request Forgery)
 * ---------------------------------------------------------------
 * Valida URLs fornecidas por usuários antes de qualquer requisição
 * feita pelo servidor, bloqueando IPs privados, loopback, link-local
 * (metadados de nuvem) e faixas reservadas.
 */

import dns from 'node:dns';
import dnsPromises from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import axios from 'axios';

const MAX_BYTES_PADRAO = 2 * 1024 * 1024; // 2 MB
const TIMEOUT_PADRAO_MS = 8000;

const blockList = new net.BlockList();

// Faixas IPv4 bloqueadas
[
    ['0.0.0.0', 8],        // "this network"
    ['10.0.0.0', 8],       // privada
    ['100.64.0.0', 10],    // CGNAT
    ['127.0.0.0', 8],      // loopback
    ['169.254.0.0', 16],   // link-local / metadados de nuvem
    ['172.16.0.0', 12],    // privada
    ['192.0.0.0', 24],     // IETF protocol assignments
    ['192.0.2.0', 24],     // documentação (TEST-NET-1)
    ['192.168.0.0', 16],   // privada
    ['198.18.0.0', 15],    // benchmarking
    ['198.51.100.0', 24],  // documentação (TEST-NET-2)
    ['203.0.113.0', 24],   // documentação (TEST-NET-3)
    ['224.0.0.0', 4],      // multicast
    ['240.0.0.0', 4],      // reservada
].forEach(([endereco, prefixo]) => {
    blockList.addSubnet(endereco, prefixo, 'ipv4');
});

// Faixas IPv6 bloqueadas
[
    ['::', 128],           // não especificado
    ['::1', 128],          // loopback
    ['fc00::', 7],         // unique local
    ['fe80::', 10],        // link-local
    ['2001:db8::', 32],    // documentação
].forEach(([endereco, prefixo]) => {
    blockList.addSubnet(endereco, prefixo, 'ipv6');
});

function ipProibido(endereco) {
    const tipo = net.isIP(endereco);

    if (tipo === 4) {
        return blockList.check(endereco, 'ipv4');
    }

    if (tipo === 6) {
        // IPv4 mapeado em IPv6 (::ffff:192.168.0.1)
        const normalizado = endereco.toLowerCase();
        if (normalizado.startsWith('::ffff:')) {
            const v4 = normalizado.slice('::ffff:'.length);
            if (net.isIP(v4) === 4) {
                return blockList.check(v4, 'ipv4');
            }
        }
        return blockList.check(endereco, 'ipv6');
    }

    return true; // valor que não é IP é tratado como bloqueado
}

/**
 * Valida uma URL e garante que ela aponta para um destino público.
 * Lança erro quando a URL é inválida ou o destino é proibido.
 */
export async function validarUrlPublica(valor) {
    let url;

    try {
        url = new URL(String(valor));
    } catch {
        throw new Error('URL inválida.');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Apenas URLs HTTP/HTTPS são permitidas.');
    }

    if (url.username || url.password) {
        throw new Error('URLs com credenciais embutidas não são permitidas.');
    }

    const portaPadrao = url.protocol === 'https:' ? 443 : 80;
    const porta = url.port ? Number.parseInt(url.port, 10) : portaPadrao;

    if (porta !== 80 && porta !== 443) {
        throw new Error('Porta não permitida.');
    }

    const host = url.hostname.replace(/^\[|\]$/g, '');

    if (!host) {
        throw new Error('URL sem host válido.');
    }

    // Host é um IP literal: valida diretamente.
    if (net.isIP(host)) {
        if (ipProibido(host)) {
            throw new Error('Destino bloqueado pela política de segurança.');
        }
        return url;
    }

    // Resolve o DNS e valida todos os endereços retornados.
    let registros;
    try {
        registros = await dnsPromises.lookup(host, { all: true, verbatim: true });
    } catch {
        throw new Error('Não foi possível resolver o host da URL.');
    }

    if (!Array.isArray(registros) || registros.length === 0) {
        throw new Error('Não foi possível resolver o host da URL.');
    }

    for (const registro of registros) {
        if (ipProibido(registro.address)) {
            throw new Error('Destino bloqueado pela política de segurança.');
        }
    }

    return url;
}

/**
 * `lookup` customizado usado pelos agents HTTP/HTTPS. Valida o IP no
 * momento da conexão, mitigando DNS rebinding (TOCTOU).
 */
function lookupSeguro(hostname, options, callback) {
    dns.lookup(hostname, { ...options, all: true }, (err, enderecos) => {
        if (err) return callback(err);

        const lista = Array.isArray(enderecos) ? enderecos : [];
        const permitidos = lista.filter((item) => !ipProibido(item.address));

        if (permitidos.length === 0 || permitidos.length !== lista.length) {
            return callback(new Error('Destino bloqueado pela política de segurança.'));
        }

        if (options && options.all) {
            return callback(null, permitidos);
        }

        return callback(null, permitidos[0].address, permitidos[0].family);
    });
}

const httpAgent = new http.Agent({ lookup: lookupSeguro, keepAlive: false });
const httpsAgent = new https.Agent({ lookup: lookupSeguro, keepAlive: false });

/**
 * GET seguro, com validação de destino, limite de tamanho e timeout.
 * Lança erro em caso de URL/destino bloqueado ou falha de rede.
 */
export async function getUrlSeguro(valor, {
    headers = {},
    timeout = TIMEOUT_PADRAO_MS,
    maxBytes = MAX_BYTES_PADRAO,
} = {}) {
    const url = await validarUrlPublica(valor);

    return axios.get(url.href, {
        headers: {
            // Evita bombas de descompressão (gzip/br).
            'Accept-Encoding': 'identity',
            ...headers,
        },
        timeout,
        maxContentLength: maxBytes,
        maxBodyLength: maxBytes,
        maxRedirects: 3,
        proxy: false,
        httpAgent,
        httpsAgent,
        responseType: 'text',
    });
}

export { MAX_BYTES_PADRAO, TIMEOUT_PADRAO_MS };
