import * as http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import { requestUrl } from 'obsidian';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

// Desktop: loopback address — Google "Desktop app" client type accepts any port on 127.0.0.1
const DESKTOP_PORT = 42813;
export const DESKTOP_REDIRECT_URI = `http://127.0.0.1:${DESKTOP_PORT}`;

// Mobile: GitHub Pages redirect page that bounces back to obsidian://calendar-importer-auth
export const MOBILE_REDIRECT_URI =
    'https://vstrickl.github.io/obsidian-calendar-importer/redirect.html';

export interface TokenData {
    access_token: string;
    refresh_token?: string;
    expires_at?: number;
}

// Desktop: open browser → local HTTP server captures the code
export async function authenticateGoogleDesktop(
    clientId: string,
    clientSecret: string,
): Promise<TokenData> {
    const code = await captureCodeViaLocalServer(clientId);
    return exchangeCodeForTokens(clientId, clientSecret, code, DESKTOP_REDIRECT_URI);
}

// Mobile: open browser → GitHub Pages page redirects to obsidian://calendar-importer-auth
// waitForCode is supplied by the plugin's registered protocol handler
export async function authenticateGoogleMobile(
    clientId: string,
    clientSecret: string,
    waitForCode: () => Promise<string>,
): Promise<TokenData> {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: MOBILE_REDIRECT_URI,
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent',
    });
    window.open(`${GOOGLE_AUTH_URL}?${params}`);
    const code = await waitForCode();
    return exchangeCodeForTokens(clientId, clientSecret, code, MOBILE_REDIRECT_URI);
}

export async function refreshAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
): Promise<TokenData> {
    const resp = await requestUrl({
        url: GOOGLE_TOKEN_URL,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }).toString(),
    });
    const data = resp.json as Record<string, string | number>;
    if (data.error) {
        throw new Error(`Token refresh failed: ${data.error_description ?? data.error}`);
    }
    return {
        access_token: data.access_token as string,
        refresh_token: refreshToken,
        expires_at: Date.now() + (data.expires_in as number) * 1000,
    };
}

function captureCodeViaLocalServer(clientId: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
            try {
                const url = new URL(req.url ?? '/', `http://127.0.0.1:${DESKTOP_PORT}`);
                const code  = url.searchParams.get('code');
                const error = url.searchParams.get('error');
                res.writeHead(200, { 'Content-Type': 'text/html' });
                if (code) {
                    res.end('<html><body><h2>Authentication successful! You can close this tab.</h2></body></html>');
                    server.close();
                    resolve(code);
                } else {
                    res.end(`<html><body><h2>Authentication failed: ${error ?? 'unknown error'}</h2></body></html>`);
                    server.close();
                    reject(new Error(error ?? 'OAuth failed'));
                }
            } catch (err) {
                reject(err);
            }
        });

        server.listen(DESKTOP_PORT, '127.0.0.1', () => {
            const params = new URLSearchParams({
                client_id: clientId,
                redirect_uri: DESKTOP_REDIRECT_URI,
                response_type: 'code',
                scope: SCOPES,
                access_type: 'offline',
                prompt: 'consent',
            });
            window.open(`${GOOGLE_AUTH_URL}?${params}`);
        });

        server.on('error', reject);

        const timeout = window.setTimeout(() => {
            server.close();
            reject(new Error('OAuth timeout: no response within 2 minutes'));
        }, 120_000);

        server.on('close', () => window.clearTimeout(timeout));
    });
}

async function exchangeCodeForTokens(
    clientId: string,
    clientSecret: string,
    code: string,
    redirectUri: string,
): Promise<TokenData> {
    const resp = await requestUrl({
        url: GOOGLE_TOKEN_URL,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }).toString(),
    });
    const data = resp.json as Record<string, string | number>;
    if (data.error) {
        throw new Error(`Token exchange failed: ${data.error_description ?? data.error}`);
    }
    return {
        access_token: data.access_token as string,
        refresh_token: data.refresh_token as string | undefined,
        expires_at: Date.now() + (data.expires_in as number) * 1000,
    };
}
