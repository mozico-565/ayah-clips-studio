<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Run recitation ASR in a browser worker and match timestamped recognized words to selected Quran text; this keeps recordings private and prevents heuristic timings being presented as recognition.
- Use one canvas Quran renderer for preview and transparent export overlays; this preserves Arabic shaping and customization in the actual MP4.
- Use licensed CDN asset pointers for downloaded background videos and fonts; this preserves provenance without committing binary downloads.
