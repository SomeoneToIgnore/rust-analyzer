import * as vscode from 'vscode';
import * as ra from './lsp_ext';

import { Ctx, Disposable } from './ctx';
import { sendRequestWithRetry, isRustDocument } from './util';

export function activateInlayHints(ctx: Ctx) {
    const maybeUpdater = {
        disposables: [] as Disposable[],
        updateHintsEventEmitter: new vscode.EventEmitter<void>(),

        async onConfigChange() {
            const anyEnabled = ctx.config.inlayHints.typeHints
                || ctx.config.inlayHints.parameterHints
                || ctx.config.inlayHints.chainingHints;
            const enabled = ctx.config.inlayHints.enable && anyEnabled;
            if (!enabled) return this.dispose();

            const event = this.updateHintsEventEmitter.event;
            const hintsDisposable = vscode.languages.registerInlineHintsProvider({ scheme: 'file', language: 'rust' }, new class implements vscode.InlineHintsProvider {
                onDidChangeInlineHints = event;
                async provideInlineHints(document: vscode.TextDocument, range: vscode.Range, token: vscode.CancellationToken): Promise<vscode.InlineHint[]> {
                    const request = { textDocument: { uri: document.uri.toString() }, range: { start: range.start, end: range.end } };
                    const hints = await sendRequestWithRetry(ctx.client, ra.inlayHints, request, token).catch(_ => null)
                    if (hints == null) {
                        return [];
                    } else {
                        return hints;
                    }
                }
            });
            this.disposables.push(hintsDisposable);

            vscode.workspace.onDidChangeTextDocument(({ contentChanges, document }: vscode.TextDocumentChangeEvent) => {
                if (contentChanges.length === 0 || !isRustDocument(document)) return;
                this.updateHintsEventEmitter.fire();
            }, this, this.disposables);
        },

        dispose() {
            this.disposables.forEach(d => d.dispose());
            this.updateHintsEventEmitter.dispose();
            this.disposables = [];
        }
    }

    ctx.pushCleanup(maybeUpdater);

    vscode.workspace.onDidChangeConfiguration(
        maybeUpdater.onConfigChange, maybeUpdater, ctx.subscriptions
    );
    maybeUpdater.onConfigChange().catch(console.error);
}
