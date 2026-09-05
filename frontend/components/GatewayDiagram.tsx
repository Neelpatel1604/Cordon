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
  fill,
  stroke,
  titleFill = "#f4f4f5",
  subtitleFill = "#a1a1aa",
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  subtitle: string;
  fill: string;
  stroke: string;
  titleFill?: string;
  subtitleFill?: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={fill} stroke={stroke} strokeWidth={1.4} />
      <text
        x={x + w / 2}
        y={y + h / 2 - 5}
        textAnchor="middle"
        fill={titleFill}
        fontSize={13}
        fontWeight={600}
        fontFamily="var(--font-geist-sans), system-ui, sans-serif"
      >
        {title}
      </text>
      <text
        x={x + w / 2}
        y={y + h / 2 + 12}
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
  const w = 140;
  const h = 72;
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
      <text x={cx} y={cy - 2} textAnchor="middle" fill="#ccfbf1" fontSize={13} fontWeight={600}>
        Qdrant
      </text>
      <text
        x={cx}
        y={cy + 14}
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
  marker: string;
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
      markerEnd={`url(#${marker})`}
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

function CacheStep({
  x,
  y,
  w,
  h,
  index,
  title,
  subtitle,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  index: string;
  title: string;
  subtitle: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill="#083d3a" stroke="#115e59" strokeWidth={1} />
      <text
        x={x + 14}
        y={y + h / 2 + 4}
        fill="#5eead4"
        fontSize={11}
        fontFamily="var(--font-geist-mono), ui-monospace, monospace"
      >
        {index}
      </text>
      <text
        x={x + 36}
        y={y + h / 2 - 4}
        fill="#ccfbf1"
        fontSize={13}
        fontWeight={600}
        fontFamily="var(--font-geist-sans), system-ui, sans-serif"
      >
        {title}
      </text>
      <text
        x={x + 36}
        y={y + h / 2 + 13}
        fill="#5eead4"
        fontSize={10}
        fontFamily="var(--font-geist-mono), ui-monospace, monospace"
      >
        {subtitle}
      </text>
    </g>
  );
}

export default function GatewayDiagram() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#070709] px-3 py-5 sm:px-6">
      <svg
        viewBox="0 0 1080 540"
        role="img"
        aria-label="Cordon architecture. Clients enter Auth, then Rate, Coalesce, and Semantic cache. Cache lookup talks to Qdrant. Gray-zone scores are reranked inside the cache. Misses go to Cohere. Hits return to clients."
        className="mx-auto h-auto w-full"
      >
        <title>Cordon architecture</title>
        <defs>
          <Marker id="m-zinc" fill="#d4d4d8" />
          <Marker id="m-teal" fill="#2dd4bf" />
          <Marker id="m-amber" fill="#f59e0b" />
        </defs>

        <rect x={20} y={36} width={188} height={420} rx={12} fill="#0c0c0f" stroke="#27272a" />
        <rect
          x={232}
          y={36}
          width={560}
          height={420}
          rx={12}
          fill="#0a1110"
          stroke="#115e59"
          strokeWidth={1.5}
          strokeDasharray="8 6"
        />
        <rect x={816} y={36} width={244} height={420} rx={12} fill="#0c0c0f" stroke="#27272a" />

        <text x={114} y={58} textAnchor="middle" fill="#71717a" fontSize={10} fontWeight={600} letterSpacing="0.16em">
          CLIENTS
        </text>
        <text x={512} y={58} textAnchor="middle" fill="#5eead4" fontSize={10} fontWeight={600} letterSpacing="0.14em">
          CORDON  ·  FastAPI :8000
        </text>
        <text x={938} y={58} textAnchor="middle" fill="#71717a" fontSize={10} fontWeight={600} letterSpacing="0.16em">
          EXTERNAL
        </text>

        <Box x={40} y={88} w={148} h={56} title="Console" subtitle="Next.js :3000" fill="#18181b" stroke="#3f3f46" />
        <Box x={40} y={168} w={148} h={56} title="Application" subtitle="Chat / Embed" fill="#18181b" stroke="#3f3f46" />

        <Box x={256} y={128} w={118} h={56} title="Auth" subtitle="HMAC + nonce" fill="#18181b" stroke="#71717a" />
        <Box
          x={414}
          y={128}
          w={118}
          h={56}
          title="Rate limit"
          subtitle="Token bucket"
          fill="#1c1410"
          stroke="#ea580c"
          titleFill="#fed7aa"
          subtitleFill="#fdba74"
        />
        <Box
          x={572}
          y={128}
          w={118}
          h={56}
          title="Coalesce"
          subtitle="In-flight join"
          fill="#16101f"
          stroke="#7c3aed"
          titleFill="#ddd6fe"
          subtitleFill="#c4b5fd"
        />

        <rect x={468} y={220} width={224} height={168} rx={12} fill="#042f2e" stroke="#2dd4bf" strokeWidth={1.5} />
        <text
          x={580}
          y={242}
          textAnchor="middle"
          fill="#99f6e4"
          fontSize={13}
          fontWeight={600}
          fontFamily="var(--font-geist-sans), system-ui, sans-serif"
        >
          Semantic cache
        </text>
        <CacheStep x={480} y={254} w={200} h={48} index="01" title="Lookup" subtitle="embed + Qdrant" />
        <rect x={548} y={308} width={64} height={18} rx={9} fill="#0f3d3a" stroke="#115e59" />
        <text
          x={580}
          y={321}
          textAnchor="middle"
          fill="#5eead4"
          fontSize={9}
          fontFamily="var(--font-geist-mono), ui-monospace, monospace"
        >
          if gray
        </text>
        <CacheStep x={480} y={332} w={200} h={44} index="02" title="Rerank" subtitle="confirm or miss" />

        <Box
          x={844}
          y={124}
          w={188}
          h={64}
          title="Cohere"
          subtitle="Chat / Embed"
          fill="#1a1406"
          stroke="#d97706"
          titleFill="#fde68a"
          subtitleFill="#fbbf24"
        />
        <Cylinder cx={938} cy={278} />

        <Box
          x={256}
          y={380}
          w={160}
          h={52}
          title="Metrics"
          subtitle="GET /v1/metrics"
          fill="#111113"
          stroke="#3f3f46"
          titleFill="#d4d4d8"
          subtitleFill="#71717a"
        />

        <Link d="M 188 116 L 220 116 L 220 156 L 256 156" color="#d4d4d8" marker="m-zinc" />
        <Link d="M 188 196 L 220 196 L 220 156" color="#d4d4d8" marker="m-zinc" />

        <Link d="M 374 156 L 414 156" color="#d4d4d8" marker="m-zinc" />
        <Link d="M 532 156 L 572 156" color="#d4d4d8" marker="m-zinc" />
        <Link d="M 631 184 L 631 216 L 580 216 L 580 220" color="#d4d4d8" marker="m-zinc" />

        <Link d="M 692 246 L 790 246 L 790 156 L 844 156" color="#f59e0b" marker="m-amber" />
        <Tag x={760} y={236} text="miss" fill="#fbbf24" />

        <Link d="M 692 278 L 868 278" color="#2dd4bf" marker="m-teal" />
        <Tag x={790} y={298} text="lookup / write" fill="#5eead4" />

        <Link d="M 468 290 L 240 290 L 240 88 L 188 88" color="#2dd4bf" dashed marker="m-teal" />
        <Tag x={350} y={282} text="hit" fill="#5eead4" />

        <Link d="M 188 144 L 204 144 L 204 406 L 256 406" color="#71717a" dashed marker="m-zinc" />
        <Tag x={204} y={424} text="observe" fill="#71717a" />

        <g transform="translate(20, 476)">
          <line x1={0} y1={16} x2={28} y2={16} stroke="#d4d4d8" strokeWidth={2} strokeLinecap="round" markerEnd="url(#m-zinc)" />
          <text x={36} y={20} fill="#a1a1aa" fontSize={12}>
            Request
          </text>
          <line x1={120} y1={16} x2={148} y2={16} stroke="#2dd4bf" strokeWidth={2} strokeDasharray="7 5" strokeLinecap="round" />
          <text x={156} y={20} fill="#a1a1aa" fontSize={12}>
            Cache hit
          </text>
          <line x1={248} y1={16} x2={276} y2={16} stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" markerEnd="url(#m-amber)" />
          <text x={284} y={20} fill="#a1a1aa" fontSize={12}>
            Miss to Cohere
          </text>
          <line x1={420} y1={16} x2={448} y2={16} stroke="#2dd4bf" strokeWidth={2} strokeLinecap="round" markerEnd="url(#m-teal)" />
          <text x={456} y={20} fill="#a1a1aa" fontSize={12}>
            Qdrant
          </text>
        </g>
      </svg>
    </div>
  );
}
