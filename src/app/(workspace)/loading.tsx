export default function Loading() {
  return (
    <div className="mx-auto max-w-[1500px] animate-pulse px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
      <div className="h-3 w-24 rounded bg-[#e5e3dc]" />
      <div className="mt-4 h-10 w-60 rounded bg-[#e5e3dc]" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 rounded-xl border bg-surface" />
        ))}
      </div>
      <div className="mt-6 h-80 rounded-xl border bg-surface" />
    </div>
  );
}
