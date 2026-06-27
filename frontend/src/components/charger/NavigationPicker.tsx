import { appleMapsUrl, googleMapsUrl, wazeUrl } from '../../utils/navigationLinks';

interface Props {
  lat: number;
  lon: number;
  onClose: () => void;
}

export function NavigationPicker({ lat, lon, onClose }: Props) {
  const links = [
    { label: 'Apple Maps', url: appleMapsUrl(lat, lon) },
    { label: 'Google Maps', url: googleMapsUrl(lat, lon) },
    { label: 'Waze', url: wazeUrl(lat, lon) },
  ];

  return (
    <div className="sheet">
      <div className="sheet-handle" />
      <h2 style={{ textAlign: 'center', marginTop: 0 }}>Choose your navigation</h2>
      {links.map((l) => (
        <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="nav-row" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          {l.label}
        </a>
      ))}
      <button className="primary-pill" style={{ background: '#8E8E93', marginTop: 8 }} onClick={onClose}>
        Close
      </button>
    </div>
  );
}
