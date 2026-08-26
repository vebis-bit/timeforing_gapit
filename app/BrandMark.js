// Full Gapit Nordics-logo i topplinja: symbol + ordmerke + undertittel.
// Symbolet er den eksakte SVG-en fra merkevareguiden (Electric Blue #1570EF,
// skal aldri fargelegges om). Ordmerket settes i Poppins i Primary/1000
// (#060C17) – sida laster allerede Poppins. Hele låsen skaleres av font-size
// på .brand-mark (se globals.css), både normalt og i 16:9-modus.
//
// Vil du heller bruke den offisielle logofila: legg en SVG/PNG i public/ og
// bytt denne komponenten til <img src="/gapit-logo.svg" alt="GAPIT" className={className} />.
export default function BrandMark({ className = "brand-mark" }) {
  return (
    <span className={className} role="img" aria-label="GAPIT – Part of CTS GROUP">
      <svg
        className="brand-mark-sym"
        viewBox="0 0 120 67"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M119.916 53.4596L119.915 52.3348L91.7075 52.3348L91.672 50.6476L91.672 31.5255L91.6892 29.8383L69.2002 29.8383L69.1753 28.7135L69.1753 1.15514L69.1485 0.0302865L51.7318 0.0303207L51.7413 1.15513L51.7413 9.59137C48.3669 10.1538 44.9926 11.2786 41.6175 12.4034L37.6809 5.65448L37.1878 4.93068L24.7457 11.841L23.9118 12.3062L24.1835 12.9659L28.1201 19.7149C25.308 21.9645 22.4959 24.7765 19.6839 28.1511L12.3438 23.9777L11.8106 24.7767L5.06188 36.5875L4.78713 37.0984L5.62415 37.7124L12.3729 41.6493C11.2483 45.0238 10.1231 48.9607 9.56079 51.7728L0.0253807 51.8236L0 52.8976L0 66.958L38.8068 66.958C37.6823 64.7084 37.6823 61.8963 37.6823 59.0842C37.6823 46.7111 47.8061 37.1501 59.6166 37.1501C71.4272 37.1501 81.551 46.7111 81.551 59.0842C81.551 61.8963 80.9886 64.7084 80.4264 66.958L119.775 66.958L119.916 53.4596Z"
          fill="#1570EF"
        />
        <rect x="104.534" y="24.3114" width="15.4657" height="15.4657" fill="#1570EF" />
        <rect x="82.0483" y="0" width="15.4657" height="15.4657" fill="#1570EF" />
      </svg>
      <span className="brand-mark-text">
        <span className="brand-mark-word">
          <b>Gapit</b>Nordics
        </span>
        <span className="brand-mark-sub">Part of CTS GROUP</span>
      </span>
    </span>
  );
}
