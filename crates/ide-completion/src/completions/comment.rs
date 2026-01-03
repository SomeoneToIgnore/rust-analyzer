use hir::{ModuleDef, Semantics};
use ide_db::RootDatabase;
use syntax::ast;
use syntax::{AstNode, AstToken, SyntaxToken, TextSize};

use crate::{
    CompletionItemKind, completions::Completions, context::CompletionContext, item::Builder,
};

// fn doc_comment_prefix_len(token: &SyntaxToken) -> Option<TextSize> {
//     let comment = ast::Comment::cast(token.clone())?;
//     if !comment.kind().is_doc() {
//         return None;
//     }
//     let len = comment.prefix().len() as u32;
//     Some(TextSize::from(len))
// }

fn fragment_in_doc_comment(
    token: &SyntaxToken,
    caret: TextSize,
    prefix_len: TextSize,
) -> Option<String> {
    let text = token.text();
    let token_start = token.text_range().start();
    let rel = caret.checked_sub(token_start + prefix_len)?;
    let rel_u32: u32 = rel.into();
    let rel_idx = rel_u32 as usize;

    let s = text.to_string();
    let bytes = s.as_bytes();
    if rel_idx > bytes.len() {
        return None;
    }

    // Find enclosing '[' .. ']'
    let mut open = None;
    for i in (0..=rel_idx).rev() {
        match bytes.get(i).copied()? {
            b'[' => {
                open = Some(i);
                break;
            }
            b']' => return None,
            _ => {}
        }
    }
    let open = open?;

    let mut close = None;
    for i in rel_idx..bytes.len() {
        match bytes.get(i).copied()? {
            b']' => {
                close = Some(i);
                break;
            }
            _ => {}
        }
    }
    let close = close?;

    // Optional backticks inside that region.
    let mut bt_open = None;
    let mut bt_close = None;
    for i in open..=close {
        if bytes.get(i).copied()? == b'`' {
            if bt_open.is_none() {
                bt_open = Some(i);
            }
            bt_close = Some(i);
        }
    }

    let (frag_start_idx, frag_end_idx) = match (bt_open, bt_close) {
        (Some(o), Some(c)) if c > o => (o + 1, c),
        _ => (open, close),
    };

    if frag_start_idx >= frag_end_idx || frag_end_idx > bytes.len() {
        return None;
    }

    let frag = s[frag_start_idx..frag_end_idx].trim();
    if frag.is_empty() { None } else { Some(frag.to_string()) }
}

pub(crate) fn complete_doc_comment(acc: &mut Completions, ctx: &CompletionContext<'_>) {
    let token = &ctx.original_token;
    // let Some(prefix_len) = doc_comment_prefix_len(token) else {
    //     return;
    // };

    // let caret = ctx.position.offset;
    // let Some(frag) = fragment_in_doc_comment(token, caret, prefix_len) else {
    //     return;
    // };

    // let sema: &Semantics<'_, RootDatabase> = &ctx.sema;
    // let db = ctx.db;
    // let module = ctx.module;

    // // Walk names visible in the current module; suggest structs whose name starts with the fragment.
    // for (name, def) in module.scope(db, None) {
    //     let text = name.display(db).to_string();
    //     if !text.starts_with(&frag) {
    //         continue;
    //     }

    //     let Some(ModuleDef::Adt(hir::Adt::Struct(strukt))) = def.as_module_def() else {
    //         continue;
    //     };

    //     let mut builder =
    //         Builder::from_module_def(ctx, &ModuleDef::Adt(hir::Adt::Struct(strukt)), None);
    //     builder.kind(CompletionItemKind::Struct);
    //     builder.add_to(acc, db);
    // }
}
