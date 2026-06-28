import { appleMapsUrl, googleMapsUrl, wazeUrl } from '../../utils/navigationLinks';
import { MenuSheet } from '../layout/MenuSheet';

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
    <MenuSheet title="Choose your navigation" onClose={onClose}>
      <div className="nav-row-list">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-row"
          >
            {l.label}
          </a>
        ))}
      </div>
    </MenuSheet>
  );
}
