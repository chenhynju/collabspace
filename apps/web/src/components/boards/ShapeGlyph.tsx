import type { BoardShape } from "@collabspace/protocol";
export default function ShapeGlyph({
  type,
  fill = "#dbeafe",
}: {
  type: BoardShape["type"];
  fill?: string;
}) {
  const props = { fill, stroke: "#64748b", strokeWidth: 1.5 };
  return (
    <svg
      viewBox="0 0 180 120"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {type === "document" ? (
        <path d="M 8 5 H 172 V 100 C 130 78 55 128 8 105 Z" {...props} />
      ) : null}
      {type === "parallelogram" ? (
        <polygon points="32,5 175,5 148,115 5,115" {...props} />
      ) : null}
      {type === "hexagon" ? (
        <polygon points="30,5 150,5 177,60 150,115 30,115 3,60" {...props} />
      ) : null}
      {type === "triangle" ? (
        <polygon points="90,5 177,115 3,115" {...props} />
      ) : null}
      {type === "database" ? (
        <>
          <path d="M 8 22 V 98 A 82 17 0 0 0 172 98 V 22 Z" {...props} />
          <ellipse cx="90" cy="22" rx="82" ry="17" {...props} />
          <path d="M 8 86 A 82 17 0 0 0 172 86" fill="none" stroke="#64748b" />
        </>
      ) : null}
      {type === "server" ? (
        <>
          {[5, 45, 85].map((y) => (
            <g key={y}>
              <rect x="8" y={y} width="164" height="30" rx="5" {...props} />
              <circle cx="20" cy={y + 15} r="3" fill="#64748b" />
              <path
                d={`M 147 ${y + 11} h 12 M 147 ${y + 19} h 12`}
                stroke="#64748b"
              />
            </g>
          ))}
        </>
      ) : null}
      {type === "cloud" ? (
        <path
          d="M 35 105 C 0 105 0 55 32 53 C 28 15 75 5 95 30 C 122 0 163 26 155 58 C 186 67 182 105 150 105 Z"
          {...props}
        />
      ) : null}
      {type === "actor" ? (
        <>
          <circle cx="90" cy="22" r="16" {...props} />
          <path
            d="M 90 38 V 75 M 55 53 H 125 M 90 75 L 60 100 M 90 75 L 120 100"
            stroke="#64748b"
            strokeWidth="3"
            fill="none"
          />
        </>
      ) : null}
    </svg>
  );
}
