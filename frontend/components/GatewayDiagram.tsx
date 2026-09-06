function Marker({ id, fill }: { id: string; fill: string }) {
  return (
    <marker id={id} markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0,0 L10,5 L0,10 Z" fill={fill} />
    </marker>
  );
}

function Box({
  x,
  y,
  w,
  h,
  title,
  subtitle,
  fill = "#131316",
  stroke = "#3f3f46",
  titleFill = "#f4f4f5",
  subtitleFill = "#71717a",
  titleSize = 13,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  subtitle: string;
  fill?: string;
  stroke?: string;
  titleFill?: string;
  subtitleFill?: string;
  titleSize?: number;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={fill} stroke={stroke} strokeWidth={1.4} />
      <text
        x={x + w / 2}
        y={y + h / 2 - 5}
        textAnchor="middle"
        fill={titleFill}
        fontSize={titleSize}
        fontWeight={600}
        fontFamily="var(--font-geist-sans), system-ui, sans-serif"
      >
        {title}
      </text>
      <text
        x={x + w / 2}
        y={y + h / 2 + 13}
        textAnchor="middle"
        fill={subtitleFill}
        fontSize={10}
        fontFamily="var(--font-geist-mono), ui-monospace, monospace"
      >
        {subtitle}
      </text>
    </g>
  );
}

function Cylinder({ cx, cy }: { cx: number; cy: number }) {
  const w = 144;
  const h = 80;
  const x = cx - w / 2;
  const y = cy - h / 2;
  return (
    <g>
      <ellipse cx={cx} cy={y + 12} rx={w / 2} ry={9} fill="#042f2e" stroke="#2dd4bf" strokeWidth={1.4} />
      <path
        d={`M ${x} ${y + 12} L ${x} ${y + h - 12} A ${w / 2} 9 0 0 0 ${x + w} ${y + h - 12} L ${x + w} ${y + 12}`}
        fill="#042f2e"
        stroke="#2dd4bf"
        strokeWidth={1.4}
      />
      <ellipse cx={cx} cy={y + h - 12} rx={w / 2} ry={9} fill="#042f2e" stroke="#2dd4bf" strokeWidth={1.4} />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#ccfbf1" fontSize={13} fontWeight={600}>
        Qdrant
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        fill="#5eead4"
        fontSize={10}
        fontFamily="var(--font-geist-mono), ui-monospace, monospace"
      >
        cordon_cache
      </text>
    </g>
  );
}

function Link({
  d,
  color,
  marker,
  dashed = false,
}: {
  d: string;
  color: string;
  marker?: string;
  dashed?: boolean;
}) {
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dashed ? "7 5" : undefined}
      markerEnd={marker ? `url(#${marker})` : undefined}
    />
  );
}

function Tag({ x, y, text, fill }: { x: number; y: number; text: string; fill: string }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill={fill}
      fontSize={10}
      fontFamily="var(--font-geist-mono), ui-monospace, monospace"
    >
      {text}
    </text>
  );
}

export default function GatewayDiagram() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#070709] px-4 py-8 sm:px-8 sm:py-10">
      <svg
        viewBox="0 0 1625 500"
        role="img"
        aria-label="Cordon architecture. Signed requests flow left to right: Auth, Rate limit, Coalesce, then Semantic cache. Cache hits return to the client. Misses continue to Cohere Chat. The cache embeds and reranks through Cohere, and reads and writes Qdrant. A gray-zone match is confirmed by Cohere Rerank before it is served."
        className="mx-auto h-auto w-full min-h-[420px] md:min-h-[520px] lg:min-h-[580px]"
      >
        <title>Cordon architecture</title>
        <defs>
          <Marker id="m-zinc" fill="#d4d4d8" />
          <Marker id="m-teal" fill="#2dd4bf" />
          <Marker id="m-coral" fill="#ff7759" />
        </defs>

        <g transform="scale(1.25)">
        {/* Zones */}
        <rect x={24} y={48} width={180} height={300} rx={12} fill="#0c0c0f" stroke="#27272a" />
        <rect
          x={232}
          y={48}
          width={620}
          height={300}
          rx={12}
          fill="#0a1110"
          stroke="#115e59"
          strokeWidth={1.5}
          strokeDasharray="8 6"
        />
        <rect x={878} y={48} width={398} height={300} rx={12} fill="#0c0c0f" stroke="#27272a" />

        <text x={114} y={70} textAnchor="middle" fill="#71717a" fontSize={10} fontWeight={600} letterSpacing="0.16em">
          CLIENTS
        </text>
        <text x={542} y={70} textAnchor="middle" fill="#5eead4" fontSize={10} fontWeight={600} letterSpacing="0.14em">
          CORDON  ·  FastAPI :8000
        </text>
        <text x={1077} y={70} textAnchor="middle" fill="#ffab97" fontSize={10} fontWeight={600} letterSpacing="0.16em">
          COHERE PLATFORM
        </text>

        {/* Clients */}
        <Box x={44} y={120} w={140} h={56} title="Console" subtitle="Next.js :3000" fill="#18181b" />
        <Box x={44} y={200} w={140} h={56} title="Application" subtitle="Chat / Embed" fill="#18181b" />

        {/* Pipeline: one row, left to right */}
        <Box x={246} y={132} w={118} h={64} title="Auth" subtitle="HMAC + nonce" />
        <Box x={388} y={132} w={118} h={64} title="Rate limit" subtitle="token bucket" />
        <Box x={530} y={132} w={118} h={64} title="Coalesce" subtitle="in-flight join" />
        <Box
          x={672}
          y={132}
          w={148}
          h={64}
          title="Semantic cache"
          subtitle="answers from Qdrant"
          fill="#042f2e"
          stroke="#2dd4bf"
          titleFill="#99f6e4"
          subtitleFill="#5eead4"
        />

        {/* Gray-zone explainer, anchored to the cache */}
        <Link d="M 700 196 L 700 236" color="#2dd4bf" dashed marker="m-teal" />
        <rect x={468} y={236} width={288} height={58} rx={8} fill="#05201e" stroke="#115e59" strokeWidth={1.2} />
        <text
          x={484}
          y={258}
          fill="#99f6e4"
          fontSize={12}
          fontWeight={600}
          fontFamily="var(--font-geist-sans), system-ui, sans-serif"
        >
          Match found but not sure?
        </text>
        <text
          x={484}
          y={278}
          fill="#5eead4"
          fontSize={10}
          fontFamily="var(--font-geist-mono), ui-monospace, monospace"
        >
          Cohere Rerank confirms before serving
        </text>

        {/* Metrics: quiet footer, observe only */}
        <Box
          x={246}
          y={288}
          w={196}
          h={40}
          title="Metrics"
          subtitle="GET /v1/metrics"
          fill="#0e0e11"
          stroke="#27272a"
          titleFill="#a1a1aa"
        />

        {/* Cohere: the platform Cordon protects and uses */}
        <Box
          x={978}
          y={118}
          w={216}
          h={92}
          title="Cohere"
          subtitle="Chat · Embed · Rerank"
          fill="#211210"
          stroke="#ff7759"
          titleFill="#ffd9cf"
          subtitleFill="#ffab97"
          titleSize={16}
        />
        <Cylinder cx={1077} cy={300} />

        {/* Clients into Auth */}
        <Link d="M 184 148 L 215 148 L 215 164 L 246 164" color="#d4d4d8" marker="m-zinc" />
        <Link d="M 184 228 L 215 228 L 215 172" color="#d4d4d8" />

        {/* Pipeline hops */}
        <Link d="M 364 164 L 388 164" color="#d4d4d8" marker="m-zinc" />
        <Link d="M 506 164 L 530 164" color="#d4d4d8" marker="m-zinc" />
        <Link d="M 648 164 L 672 164" color="#d4d4d8" marker="m-zinc" />

        {/* New question: request continues to Cohere Chat */}
        <Link d="M 820 138 L 978 138" color="#d4d4d8" marker="m-zinc" />
        <Tag x={899} y={126} text="new question" fill="#a1a1aa" />

        {/* Cache service calls: Cohere Embed + Rerank */}
        <Link d="M 820 204 L 978 204" color="#ff7759" marker="m-coral" />
        <Tag x={899} y={222} text="embed · rerank" fill="#ffab97" />

        {/* Cache <-> Qdrant */}
        <Link d="M 790 196 L 790 300 L 1005 300" color="#2dd4bf" marker="m-teal" />
        <Tag x={890} y={318} text="store / find" fill="#5eead4" />

        {/* Hit: rail over the top, back to the client */}
        <Link d="M 746 132 L 746 100 L 114 100 L 114 120" color="#2dd4bf" dashed marker="m-teal" />
        <Tag x={430} y={92} text="answered from cache · no Cohere call" fill="#5eead4" />

        {/* Legend */}
        <g transform="translate(24, 362)">
          <line x1={0} y1={16} x2={28} y2={16} stroke="#d4d4d8" strokeWidth={2} strokeLinecap="round" markerEnd="url(#m-zinc)" />
          <text x={36} y={20} fill="#a1a1aa" fontSize={12}>
            Request
          </text>
          <line x1={120} y1={16} x2={148} y2={16} stroke="#2dd4bf" strokeWidth={2} strokeDasharray="7 5" strokeLinecap="round" />
          <text x={156} y={20} fill="#a1a1aa" fontSize={12}>
            Cache hit
          </text>
          <line x1={248} y1={16} x2={276} y2={16} stroke="#ff7759" strokeWidth={2} strokeLinecap="round" markerEnd="url(#m-coral)" />
          <text x={284} y={20} fill="#a1a1aa" fontSize={12}>
            Cohere call
          </text>
          <line x1={396} y1={16} x2={424} y2={16} stroke="#2dd4bf" strokeWidth={2} strokeLinecap="round" markerEnd="url(#m-teal)" />
          <text x={432} y={20} fill="#a1a1aa" fontSize={12}>
            Qdrant
          </text>
        </g>
        </g>
      </svg>
    </div>
  );
}
