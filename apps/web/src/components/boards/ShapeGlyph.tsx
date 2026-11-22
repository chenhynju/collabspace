import type { BoardShape } from "@collabspace/protocol";
export default function ShapeGlyph({
  type,
  fill = "#dbeafe",
}: {
  type: BoardShape["type"];
  fill?: string;
}) {
  const props = { fill, stroke: "#64748b", strokeWidth: 1.5 };
  const label = (text: string, size = 26) => (
    <text
      x="90"
      y="68"
      textAnchor="middle"
      fill="#475569"
      fontSize={size}
      fontWeight={700}
      fontFamily="ui-sans-serif, system-ui, sans-serif"
    >
      {text}
    </text>
  );
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
      {type === "parallelogram" ? <polygon points="32,5 175,5 148,115 5,115" {...props} /> : null}
      {type === "hexagon" ? (
        <polygon points="30,5 150,5 177,60 150,115 30,115 3,60" {...props} />
      ) : null}
      {type === "triangle" ? <polygon points="90,5 177,115 3,115" {...props} /> : null}
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
              <path d={`M 147 ${y + 11} h 12 M 147 ${y + 19} h 12`} stroke="#64748b" />
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
      {type === "umlClass" ? (
        <>
          <rect x="8" y="5" width="164" height="110" rx="3" {...props} />
          <path d="M 8 40 H 172 M 8 78 H 172" stroke="#64748b" />
          <path d="M 18 22 h 44 M 18 58 h 60 M 18 68 h 48 M 18 96 h 54" stroke="#94a3b8" strokeWidth="3" />
        </>
      ) : null}
      {type === "umlInterface" ? (
        <>
          <rect x="8" y="15" width="164" height="90" rx="3" {...props} />
          <circle cx="150" cy="15" r="12" fill="#fff" stroke="#64748b" />
          <path d="M 144 15 h 12 M 150 9 v 12" stroke="#64748b" />
          <path d="M 18 42 h 54 M 18 54 h 74 M 18 66 h 62" stroke="#94a3b8" strokeWidth="3" />
        </>
      ) : null}
      {type === "umlComponent" ? (
        <>
          <rect x="14" y="15" width="158" height="90" rx="4" {...props} />
          <rect x="4" y="30" width="20" height="16" rx="2" fill="#fff" stroke="#64748b" />
          <rect x="4" y="58" width="20" height="16" rx="2" fill="#fff" stroke="#64748b" />
        </>
      ) : null}
      {type === "umlPackage" ? (
        <>
          <path d="M 8 30 H 70 V 12 H 8 Z" {...props} />
          <rect x="8" y="30" width="164" height="80" {...props} />
        </>
      ) : null}
      {type === "umlUseCase" ? <ellipse cx="90" cy="60" rx="82" ry="48" {...props} /> : null}
      {type === "umlLifeline" ? (
        <>
          <rect x="35" y="5" width="110" height="34" rx="3" {...props} />
          <path d="M 90 39 V 115" stroke="#64748b" strokeDasharray="6 5" />
        </>
      ) : null}
      {type === "erdEntity" ? (
        <>
          <rect x="8" y="8" width="164" height="104" rx="2" {...props} />
          <path d="M 8 38 H 172" stroke="#64748b" />
          <path d="M 18 24 h 50 M 18 54 h 60 M 18 70 h 74 M 18 86 h 52 M 18 102 h 64" stroke="#94a3b8" strokeWidth="3" />
        </>
      ) : null}
      {type === "erdRelationship" ? (
        <polygon points="90,8 174,60 90,112 6,60" {...props} />
      ) : null}
      {type === "router" ? (
        <>
          <circle cx="90" cy="60" r="50" {...props} />
          <path d="M 48 60 H 132 M 58 48 L 48 60 L 58 72 M 122 48 L 132 60 L 122 72 M 90 18 V 102 M 78 28 L 90 18 L 102 28 M 78 92 L 90 102 L 102 92" fill="none" stroke="#475569" strokeWidth="3" />
        </>
      ) : null}
      {type === "switch" ? (
        <>
          <rect x="8" y="30" width="164" height="60" rx="4" {...props} />
          <path d="M 32 45 L 86 75 M 86 45 L 32 75 M 94 45 L 148 75 M 148 45 L 94 75" stroke="#475569" strokeWidth="3" fill="none" />
        </>
      ) : null}
      {type === "firewall" ? (
        <>
          <rect x="8" y="10" width="164" height="100" rx="2" {...props} />
          {[10, 40, 70, 100].map((y, row) => (
            <path
              key={y}
              d={`M 8 ${y + 20} H 172`}
              stroke="#64748b"
            />
          ))}
          {[30, 70, 110, 150].map((x, col) => (
            <path key={x} d={`M ${x} 10 V 110`} stroke="#64748b" opacity={col % 2 ? 0.35 : 0.7} />
          ))}
        </>
      ) : null}
      {type === "loadBalancer" ? (
        <>
          <circle cx="45" cy="60" r="30" {...props} />
          <path d="M 75 60 H 120 M 120 60 L 155 25 M 120 60 H 158 M 120 60 L 155 95" stroke="#475569" strokeWidth="3" fill="none" />
          <circle cx="158" cy="25" r="10" {...props} />
          <circle cx="161" cy="60" r="10" {...props} />
          <circle cx="158" cy="95" r="10" {...props} />
        </>
      ) : null}
      {type === "internet" ? (
        <>
          <circle cx="90" cy="60" r="50" {...props} />
          <ellipse cx="90" cy="60" rx="24" ry="50" fill="none" stroke="#475569" />
          <path d="M 40 60 H 140 M 50 35 H 130 M 50 85 H 130" fill="none" stroke="#475569" />
        </>
      ) : null}
      {type === "aws" ? (
        <>
          <path d="M 35 100 C 5 100 5 58 34 56 C 30 22 74 12 94 36 C 120 8 158 32 150 60 C 180 68 176 100 148 100 Z" {...props} />
          {label("AWS", 30)}
        </>
      ) : null}
      {type === "azure" ? (
        <>
          <path d="M 10 105 L 55 15 L 105 15 L 65 105 Z" {...props} />
          <path d="M 70 60 L 170 60 L 140 105 L 65 105 Z" fill="#fff" fillOpacity="0.55" stroke="#64748b" />
          {label("Azure", 24)}
        </>
      ) : null}
      {type === "gcp" ? (
        <>
          <path d="M 35 100 C 5 100 5 58 34 56 C 30 22 74 12 94 36 C 120 8 158 32 150 60 C 180 68 176 100 148 100 Z" {...props} />
          {label("GCP", 30)}
        </>
      ) : null}
      {type === "cloudStorage" ? (
        <>
          <path d="M 20 30 V 92 A 70 15 0 0 0 160 92 V 30 Z" {...props} />
          <ellipse cx="90" cy="30" rx="70" ry="15" {...props} />
          <path d="M 20 78 A 70 15 0 0 0 160 78" fill="none" stroke="#64748b" />
          {label("S3", 24)}
        </>
      ) : null}
      {type === "cloudQueue" ? (
        <>
          {[10, 40, 70].map((y) => (
            <rect key={y} x="30" y={y} width="120" height="30" rx="5" {...props} />
          ))}
          <path d="M 45 25 h 90 M 45 55 h 90 M 45 85 h 90" stroke="#94a3b8" strokeWidth="3" />
        </>
      ) : null}
      {type === "k8sPod" ? (
        <>
          <polygon points="90,8 166,48 166,92 90,112 14,92 14,48" {...props} />
          <circle cx="90" cy="60" r="20" fill="#fff" fillOpacity="0.7" stroke="#64748b" />
          <path d="M 90 40 V 80 M 70 60 H 110" stroke="#64748b" />
        </>
      ) : null}
      {type === "k8sService" ? (
        <>
          <polygon points="90,10 170,100 10,100" {...props} />
          <circle cx="90" cy="74" r="18" fill="#fff" fillOpacity="0.7" stroke="#64748b" />
        </>
      ) : null}
      {type === "k8sDeployment" ? (
        <>
          {[8, 34, 60].map((y, i) => (
            <rect key={y} x={20 + i * 10} y={y} width={140 - i * 20} height="34" rx="6" {...props} />
          ))}
        </>
      ) : null}
      {type === "k8sIngress" ? (
        <>
          <rect x="70" y="35" width="100" height="60" rx="5" {...props} />
          <path d="M 5 65 H 60 M 50 55 L 60 65 L 50 75" fill="none" stroke="#475569" strokeWidth="4" />
          <path d="M 88 50 H 152 M 88 65 H 152 M 88 80 H 130" stroke="#94a3b8" strokeWidth="3" />
        </>
      ) : null}
      {type === "bpmnStart" ? <circle cx="90" cy="60" r="42" {...props} /> : null}
      {type === "bpmnEnd" ? (
        <circle cx="90" cy="60" r="42" fill={fill} stroke="#334155" strokeWidth="6" />
      ) : null}
      {type === "bpmnTask" ? <rect x="6" y="20" width="168" height="80" rx="14" {...props} /> : null}
      {type === "bpmnGateway" ? (
        <>
          <polygon points="90,8 174,60 90,112 6,60" {...props} />
          <path d="M 70 40 L 110 80 M 110 40 L 70 80" stroke="#475569" strokeWidth="4" />
        </>
      ) : null}
      {type === "bpmnSubprocess" ? (
        <>
          <rect x="6" y="20" width="168" height="80" rx="14" {...props} />
          <rect x="70" y="50" width="40" height="20" rx="3" fill="#fff" stroke="#64748b" />
          <path d="M 90 50 V 70 M 80 60 H 100" stroke="#64748b" />
        </>
      ) : null}
    </svg>
  );
}
