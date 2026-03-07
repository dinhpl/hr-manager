export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: '#D3F2E7' }}
      >
        <span className="text-3xl" style={{ color: '#1DB87A' }}>
          🚧
        </span>
      </div>
      <h2 className="text-lg font-bold" style={{ color: '#203430' }}>
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">Tính năng đang được phát triển.</p>
    </div>
  );
}
