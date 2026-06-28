import { appleMapsUrl, googleMapsUrl, wazeUrl } from '../../utils/navigationLinks';
import { MenuSheet } from '../layout/MenuSheet';

interface Props {
  lat: number;
  lon: number;
  name?: string | null;
  address?: string | null;
  onClose: () => void;
}

export function NavigationPicker({ lat, lon, name, address, onClose }: Props) {
  const target = { lat, lon, name, address };
  const links = [
    { label: 'Apple Maps', url: appleMapsUrl(target) },
    { label: 'Google Maps', url: googleMapsUrl(target) },
    { label: 'Waze', url: wazeUrl(target) },
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
