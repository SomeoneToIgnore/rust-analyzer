import * as lc from "vscode-languageclient";
import * as vscode from 'vscode';
import * as ra from './lsp_ext';

import { Ctx, Disposable } from './ctx';
import { sendRequestWithRetry } from './util';

export function activateInlayHints(ctx: Ctx) {
    const maybeUpdater = {
        disposable: null as null | Disposable,

        async onConfigChange() {
            this.disposable?.dispose();

            const anyEnabled = ctx.config.inlayHints.typeHints
                || ctx.config.inlayHints.parameterHints
                || ctx.config.inlayHints.chainingHints;
            if (!ctx.config.inlayHints.enable || !anyEnabled) return;

            this.disposable = vscode.languages.registerInlineHintsProvider({ scheme: 'file', language: 'rust' }, new class implements vscode.InlineHintsProvider {
                async provideInlineHints(document: vscode.TextDocument, _range: vscode.Range, token: vscode.CancellationToken): Promise<vscode.InlineHint[]> {
                    const request = { textDocument: { uri: document.uri.toString() } };
                    const hints = await sendRequestWithRetry(ctx.client, ra.inlayHints, request, token).catch(_ => null)
                    if (hints == null) {
                        return [];
                    } else {
                        return hints;
                    }
                }
            });
        },
        dispose() {
            this.disposable?.dispose();
        }
    }

    ctx.pushCleanup(maybeUpdater);

    vscode.workspace.onDidChangeConfiguration(
        maybeUpdater.onConfigChange, maybeUpdater, ctx.subscriptions
    );
    maybeUpdater.onConfigChange().catch(console.error);
}
