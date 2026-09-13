import "../whatsapp-workspace.css";

/**
 * The workspace, before it has anything to show.
 *
 * WHY IT IS SHAPED LIKE THE WORKSPACE.
 *
 * It used to be three grey bars stacked down the page. Against a three-pane
 * inbox that is not a loading state, it is a different screen: the layout
 * appears, then jumps, and on a slow connection the jump is the thing staff
 * notice. Drawing the real frame — list on the left, thread in the middle —
 * means the only change on load is grey turning into content.
 *
 * `aria-hidden` because there is nothing here to read. The route announces
 * itself when it arrives; a screen reader has no use for placeholder bars.
 */
export function WhatsappLoadingSkeleton() {
  return (
    <div className="od-wa" aria-hidden="true" data-testid="whatsapp-skeleton">
      <div className="od-wa__pane od-wa__pane--list">
        <div className="od-wa__head">
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
            <div className="od-wa__sk od-wa__sk--title" />
            <div className="od-wa__sk od-wa__sk--sub" />
          </div>
        </div>
        <div className="od-wa__scroll">
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <div className="od-wa__sk-row" key={row}>
              <div className="od-wa__sk od-wa__sk--avatar" />
              <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <div className="od-wa__sk od-wa__sk--name" />
                <div className="od-wa__sk od-wa__sk--line" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="od-wa__pane od-wa__pane--chat">
        <div className="od-wa__head">
          <div className="od-wa__sk od-wa__sk--avatar" />
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div className="od-wa__sk od-wa__sk--name" />
            <div className="od-wa__sk od-wa__sk--sub" />
          </div>
        </div>
        <div className="od-wa__scroll od-wa__thread">
          {/* Alternating sides, so the shape reads as a conversation. */}
          <div className="od-wa__sk od-wa__sk--bubble od-wa__sk--in" />
          <div className="od-wa__sk od-wa__sk--bubble od-wa__sk--out" />
          <div className="od-wa__sk od-wa__sk--bubble od-wa__sk--in od-wa__sk--short" />
          <div className="od-wa__sk od-wa__sk--bubble od-wa__sk--out" />
        </div>
        <div className="od-wa__composer">
          <div className="od-wa__sk od-wa__sk--composer" />
        </div>
      </div>
    </div>
  );
}
