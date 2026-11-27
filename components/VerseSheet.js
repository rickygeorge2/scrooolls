'use client';

// Slides up from the bottom to show a story's Bible verse, plus its read-more link if it has one.
export default function VerseSheet({ story, onClose, onOpenLink }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={story.verse_ref} onClick={(e) => e.stopPropagation()}>
        <div className="small" style={{ fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--soft)' }}>{story.verse_translation || 'World English Bible'}</div>
        <h2 style={{ fontSize: 26 }}>{story.verse_ref}</h2>
        <p style={{ fontSize: 19, fontWeight: 500, lineHeight: 1.6, color: '#2A2D36' }}>{story.verse_text}</p>
        {story.link && (
          <a className="btn" href={story.link} target="_blank" rel="noopener noreferrer" onClick={onOpenLink}>Read more</a>
        )}
        <button className="btn outline" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
