export function sendJson(response, status, body) {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
}

export function sendError(response, status, code, requestId) {
    sendJson(response, status, {
        error: { code, message: code, requestId },
    });
}

export function readJson(request, onBody) {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => onBody(JSON.parse(body)));
}
