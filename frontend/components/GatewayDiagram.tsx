function Marker({ id, fill }: { id: string; fill: string }) {
  return (
    <marker id={id} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 Z" fill={fill} />
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
      <rect x={x} y={y} width={w} height={h} rx={8} fill={fill} stroke={stroke} strokeWidth={1.5} />
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

function Cylinder({
  cx,
  cy,
  title,
  subtitle,
}: {
  cx: number;
  cy: number;
  title: string;
  subtitle: string;
}) {
  const w = 118;
  const h = 70;
  const x = cx - w / 2;
  const y = cy - h / 2;
  return (
    <g>
      <ellipse cx={cx} cy={y + 13} rx={w / 2} ry={10} fill="#042f2e" stroke="#2dd4bf" strokeWidth={1.5} />
      <path
        d={`M ${x} ${y + 13} L ${x} ${y + h - 13} A ${w / 2} 10 0 0 0 ${x + w} ${y + h - 13} L ${x + w} ${y + 13}`}
        fill="#042f2e"
        stroke="#2dd4bf"
        strokeWidth={1.5}
      />
      <ellipse cx={cx} cy={y + h - 13} rx={w / 2} ry={10} fill="#042f2e" stroke="#2dd4bf" strokeWidth={1.5} />
      <text x={cx} y={cy - 2} textAnchor="middle" fill="#ccfbf1" fontSize={13} fontWeight={600}>
        {title}
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        fill="#5eead4"
        fontSize={10}
        fontFamily="var(--font-geist-mono), ui-monospace, monospace"
      >
        {subtitle}
      </text>
    </g>
  );
}

function Path({
  d,
  color,
  dashed = false,
  marker,
}: {
  d: string;
  color: string;
  dashed?: boolean;
  marker: string;
}) {
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeDasharray={dashed ? "6 5" : undefined}
      markerEnd={`url(#${marker})`}
    />
  );
}

function Caption({
  x,
  y,
  text,
  fill,
  anchor = "middle",
}: {
  x: number;
  y: number;
  text: string;
  fill: string;
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fill={fill}
      fontSize={11}
      fontFamily="var(--font-geist-mono), ui-monospace, monospace"
    >
      {text}
    </text>
  );
}

export default function GatewayDiagram() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#070709] px-2 py-4 sm:px-4 sm:py-6">
      <svg
        viewBox="0 0 1040 480"
        role="img"
        aria-label="Cordon sits between the client and Cohere. Requests pass Auth, Rate limit, Coalesce, then Semantic cache. Cache hits return to the client. Misses call Cohere and store vectors in Qdrant."
        className="mx-auto h-auto w-full"
      >
        <title>Cordon architecture</title>
        <defs>
          <Marker id="m-zinc" fill="#71717a" />
          <Marker id="m-teal" fill="#2dd4bf" />
          <Marker id="m-amber" fill="#f59e0b" />
        </defs>

        {/* Gateway boundary */}
        <rect
          x={208}
          y={92}
          width={548}
          height={220}
          rx={14}
          fill="#0a1110"
          stroke="#115e59"
          strokeWidth={1.4}
          strokeDasharray="8 6"
        />
        <text
          x={224}
          y={116}
          fill="#5eead4"
          fontSize={11}
          fontWeight={600}
          letterSpacing="0.16em"
          fontFamily="var(--font-geist-mono), ui-monospace, monospace"
        >
          CORDON GATEWAY
        </text>

        {/* Client - left of the pipeline, aligned with the flow */}
        <Box
          x={28}
          y={164}
          w={148}
          h={68}
          title="Client"
          subtitle="Chat / Embed"
          fill="#18181b"
          stroke="#52525b"
        />

        {/* Pipeline, left to right */}
        <Box x={228} y={172} w={112} h={56} title="1  Auth" subtitle="HMAC verify" fill="#18181b" stroke="#71717a" />
        <Box
          x={360}
          y={172}
          w={112}
          h={56}
          title="2  Rate"
          subtitle="Token bucket"
          fill="#1c1410"
          stroke="#ea580c"
          titleFill="#fed7aa"
          subtitleFill="#fdba74"
        />
        <Box
          x={492}
          y={172}
          w={112}
          h={56}
          title="3  Coalesce"
          subtitle="In-flight join"
          fill="#16101f"
          stroke="#7c3aed"
          titleFill="#ddd6fe"
          subtitleFill="#c4b5fd"
        />
        <Box
          x={624}
          y={172}
          w={112}
          h={56}
          title="4  Cache"
          subtitle="Embed lookup"
          fill="#042f2e"
          stroke="#2dd4bf"
          titleFill="#99f6e4"
          subtitleFill="#5eead4"
        />

        {/* External systems - own column, not in the pipeline */}
        <text
          x={900}
          y={84}
          textAnchor="middle"
          fill="#71717a"
          fontSize={10}
          letterSpacing="0.12em"
          fontFamily="var(--font-geist-mono), ui-monospace, monospace"
        >
          DEPENDENCIES
        </text>
        <Cylinder cx={900} cy={132} title="Qdrant" subtitle="vector store" />
        <Box
          x={830}
          y={248}
          w={140}
          h={64}
          title="Cohere API"
          subtitle="Chat / Embed"
          fill="#1a1406"
          stroke="#d97706"
          titleFill="#fde68a"
          subtitleFill="#fbbf24"
        />

        {/* 1. Request: straight left-to-right into Auth */}
        <Path d="M 176 198 L 228 198" color="#a1a1aa" marker="m-zinc" />
        <Caption x={202} y={188} text="request" fill="#a1a1aa" />

        {/* 2. Pipeline hops */}
        <Path d="M 340 200 L 360 200" color="#a1a1aa" marker="m-zinc" />
        <Path d="M 472 200 L 492 200" color="#a1a1aa" marker="m-zinc" />
        <Path d="M 604 200 L 624 200" color="#a1a1aa" marker="m-zinc" />

        {/* 3. Cache hit: dedicated path ABOVE the gateway, never shares the request line */}
        <Path d="M 680 172 L 680 48 L 102 48 L 102 164" color="#2dd4bf" dashed marker="m-teal" />
        <Caption x={390} y={38} text="cache hit  -  skip Cohere" fill="#5eead4" />

        {/* 4. Lookup: cache right -> Qdrant left */}
        <Path d="M 736 186 L 812 142" color="#2dd4bf" marker="m-teal" />
        <Caption x={768} y={154} text="lookup" fill="#5eead4" anchor="start" />

        {/* 5. Miss: cache right -> Cohere left */}
        <Path d="M 736 214 L 830 272" color="#f59e0b" marker="m-amber" />
        <Caption x={768} y={256} text="miss" fill="#fbbf24" anchor="start" />

        {/* 6. Persist: Cohere -> Qdrant (result written after a miss) */}
        <Path d="M 900 248 L 900 168" color="#71717a" dashed marker="m-zinc" />
        <Caption x={912} y={214} text="store" fill="#a1a1aa" anchor="start" />

        {/* Legend */}
        <g transform="translate(28, 430)">
          <line x1={0} y1={0} x2={28} y2={0} stroke="#a1a1aa" strokeWidth={1.6} markerEnd="url(#m-zinc)" />
          <text x={36} y={4} fill="#a1a1aa" fontSize={12}>
            Request path
          </text>
          <line x1={160} y1={0} x2={188} y2={0} stroke="#2dd4bf" strokeWidth={1.6} strokeDasharray="6 5" />
          <text x={196} y={4} fill="#a1a1aa" fontSize={12}>
            Cache hit
          </text>
          <line x1={288} y1={0} x2={316} y2={0} stroke="#f59e0b" strokeWidth={1.6} markerEnd="url(#m-amber)" />
          <text x={324} y={4} fill="#a1a1aa" fontSize={12}>
            Upstream miss
          </text>
          <line x1={456} y1={0} x2={484} y2={0} stroke="#71717a" strokeWidth={1.6} strokeDasharray="6 5" />
          <text x={492} y={4} fill="#a1a1aa" fontSize={12}>
            Write to Qdrant
          </text>
        </g>
      </svg>
    </div>
  );
}
