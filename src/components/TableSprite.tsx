import art from "../../public/assets/lobby-v1/manifest.json";

/** Shared image files; seats only control the character layers, never fake players. */
export function TableSprite({ occupied }: { occupied: [boolean, boolean] }) {
  return (
    <svg
      className="table-sprite"
      viewBox={art.viewBox.join(" ")}
      aria-hidden="true"
      focusable="false"
    >
      {art.layers.map((layer) =>
        layer.seat !== undefined && !occupied[layer.seat] ? null : (
          <image
            key={layer.name}
            data-layer={layer.name}
            href={`/assets/lobby-v1/${layer.file}`}
            x={layer.x}
            y={layer.y}
            width={layer.size}
            height={layer.size}
            preserveAspectRatio="xMidYMid meet"
          />
        ),
      )}
    </svg>
  );
}
