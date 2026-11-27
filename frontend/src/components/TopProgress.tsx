/** Sayfanın en üstünde ince, sürekli kayan yükleme çubuğu (Suspense ya da veri yüklenirken) */
export function TopProgress({ label = 'Yükleniyor' }: { label?: string }) {
  return (
    <div className="top-progress" role="status" aria-label={label}>
      <span className="top-progress__bar" />
    </div>
  );
}
