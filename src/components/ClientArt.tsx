export function ToolbarIcon({
  kind,
}: {
  kind:
    | "home"
    | "account"
    | "practice"
    | "star"
    | "rooms"
    | "settings"
    | "help"
    | "exit";
}) {
  return (
    <svg
      className={`toolbar-icon icon-${kind}`}
      viewBox="0 0 24 24"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {kind === "home" && (
        <>
          <path d="M2 2h19v15H2z" fill="#000" />
          <path d="M2 2h18v14H2z" fill="#c0c0c0" />
          <path d="M3 3h15v11H3z" fill="#fff" />
          <path d="M4 4h15v11H4z" fill="#808080" />
          <path d="M5 5h13v9H5z" fill="#008080" />
          <path d="M8 7h3v3H8z" fill="#ff0000" />
          <path d="M12 7h3v3h-3z" fill="#00ff00" />
          <path d="M8 11h3v2H8z" fill="#0000ff" />
          <path d="M12 11h3v2h-3z" fill="#ffff00" />
          <path d="M9 17h5v3H9zM2 21h20v2H2z" fill="#000" />
          <path d="M8 17h5v2H8zM2 19h18v3H2z" fill="#808080" />
          <path d="M3 19h17v1H3zM2 20h19v1H2z" fill="#fff" />
        </>
      )}
      {kind === "account" && (
        <>
          <path
            d="M7 1h9v2h2v9h-2v3h3v2h3v6H2v-6h3v-2h3v-3H6V3h1z"
            fill="#000"
          />
          <path d="M8 3h8v8h-2v3h-4v-3H8z" fill="#ffff00" />
          <path d="M8 3h8v2H8zM7 5h2v5H7z" fill="#808000" />
          <path d="M14 6h2v2h-2zM10 6h1v2h-1zM11 10h3v1h-3z" fill="#800000" />
          <path d="M6 16h4l2 3 2-3h4v2h2v4H4v-4h2z" fill="#000080" />
          <path d="m8 15 4 4 4-4h-2l-2 2-2-2z" fill="#fff" />
          <path d="M4 18h2v4H4zM6 16h2v2H6z" fill="#0000ff" />
        </>
      )}
      {kind === "practice" && (
        <>
          <path d="M1 4h15v18H1z" fill="#000" />
          <path d="M2 5h13v16H2z" fill="#fff" />
          <path d="M3 6h3v2H3zM3 9h3v2H3z" fill="#ff0000" />
          <path d="M7 1h16v19H7z" fill="#000" />
          <path d="M8 2h14v17H8z" fill="#fff" />
          <path d="M10 4h10v10H10z" fill="#c0c0c0" />
          <path
            d="M10 4h2v2h-2zM14 4h2v2h-2zM18 4h2v2h-2zM12 6h2v2h-2zM16 6h2v2h-2zM10 8h2v2h-2zM14 8h2v2h-2zM18 8h2v2h-2zM12 10h2v2h-2zM16 10h2v2h-2zM10 12h2v2h-2zM14 12h2v2h-2zM18 12h2v2h-2z"
            fill="#000080"
          />
          <path d="M10 16h10v1H10z" fill="#808080" />
        </>
      )}
      {(kind === "star" || kind === "rooms") && (
        <>
          <path d="M1 5h9l2 3h11v14H1z" fill="#000" />
          <path d="M2 6h7l2 3h11v12H2z" fill="#808000" />
          <path d="M2 10h19v3H2z" fill="#ffff00" />
          <path d="M4 12h19l-3 9H1z" fill="#ffff00" />
          <path d="M4 12h19v1H4zM1 20h19v1H1z" fill="#fff" />
          {kind === "star" && (
            <>
              <path
                d="m16 1 2 4h5l-4 3 2 5-5-3-4 3 1-5-4-3h5z"
                fill="#800000"
              />
              <path
                d="m16 2 1 4h4l-3 2 1 3-3-2-3 2 1-3-3-2h4z"
                fill="#ffff00"
              />
            </>
          )}
        </>
      )}
      {kind === "settings" && (
        <>
          <path d="M1 2h22v20H1z" fill="#000" />
          <path d="M2 3h20v18H2z" fill="#c0c0c0" />
          <path d="M2 3h20v1H2zM2 3h1v18H2z" fill="#fff" />
          <path d="M6 5h1v14H6zM12 5h1v14h-1zM18 5h1v14h-1z" fill="#808080" />
          <path d="M7 5h1v14H7zM13 5h1v14h-1zM19 5h1v14h-1z" fill="#fff" />
          <path d="M4 7h6v5H4zM10 13h6v5h-6zM16 6h6v5h-6z" fill="#000" />
          <path d="M4 7h5v4H4zM10 13h5v4h-5zM16 6h5v4h-5z" fill="#000080" />
          <path d="M4 7h5v1H4zM10 13h5v1h-5zM16 6h5v1h-5z" fill="#00ffff" />
        </>
      )}
      {kind === "help" && (
        <>
          <path d="M3 1h16l3 3v17H5l-3-3V3z" fill="#000" />
          <path d="M4 2h14v17H4z" fill="#808000" />
          <path d="M6 2h12v17H6z" fill="#ffff00" />
          <path d="M5 19h16v1H5zM19 4h2v15h-2z" fill="#fff" />
          <path
            d="M10 4h5v1h2v5h-2v2h-2v2h-2v-3h2V9h2V6h-4v2H9V5h1zM11 16h2v2h-2z"
            fill="#000080"
          />
        </>
      )}
      {kind === "exit" && (
        <>
          <path d="M3 1h14v22H3z" fill="#000" />
          <path d="M4 2h12v20H4z" fill="#808080" />
          <path d="M5 3h9v18H5z" fill="#800000" />
          <path d="M6 4h2v16H6zM5 21h11v1H5z" fill="#ffff00" />
          <path d="M12 11h1v2h-1z" fill="#fff" />
          <path d="M18 6h2v2h2v2h2v4h-2v2h-2v2h-2v-4h-7v-4h7z" fill="#000" />
          <path d="m19 8 4 4-4 4v-3h-7v-2h7z" fill="#ff0000" />
          <path d="M12 11h7v1h-7z" fill="#ff8080" />
        </>
      )}
    </svg>
  );
}

export function PlayerPortrait({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "player-portrait small" : "player-portrait"}
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={small ? "portraitSmall" : "portraitLarge"}
          x2="0"
          y2="1"
        >
          <stop stopColor="#b9edff" />
          <stop offset="1" stopColor="#2a80b1" />
        </linearGradient>
      </defs>
      <circle
        cx="24"
        cy="24"
        r="23"
        fill={`url(#${small ? "portraitSmall" : "portraitLarge"})`}
        stroke="#e4faff"
        strokeWidth="2"
      />
      <path d="M8 45c1-12 8-17 16-17s15 5 16 17" fill="#154571" />
      <path d="m16 30 8 12 8-12" fill="#e8f4f2" />
      <ellipse cx="24" cy="21" rx="11" ry="13" fill="#f3cdac" />
      <path
        d="M13 19c-1-10 7-15 15-12 8 2 10 9 7 16l-4-7-11-2-5 8z"
        fill="#403631"
      />
      <path
        d="M10 13c6-10 17-10 27-2l-3 6-17-1z"
        fill="#183a58"
        stroke="#476880"
      />
      <path d="m10 16 10-3 18 3-2 3-22 1z" fill="#487485" />
      <path d="M17 22h5m4 0h5" stroke="#3e3a36" strokeWidth="2" />
      <path d="M20 29q4 3 8 0" fill="none" stroke="#ae7663" />
      <path d="m24 34-3 4 3 8 3-8z" fill="#269aca" />
    </svg>
  );
}
