import { useState } from 'react';
import { getSpecies, spriteUrl, remoteSpriteUrl } from '../data/pokedex';
import { TYPE_META } from '../data/typeChart';
import { FINISH_META } from '../game/finish';
import type { Finish } from '../types';

interface Props {
  speciesId: string;
  finish?: Finish | null;
  size?: number;
  showTier?: boolean;
  showType?: boolean;
}

/** Renders a Pokémon sprite with a type-coloured ring, a tier badge, a type
 *  icon and an optional special-finish glow, with a graceful fallback. */
export default function PokemonSprite({
  speciesId,
  finish,
  size = 56,
  showTier = true,
  showType = true,
}: Props) {
  const species = getSpecies(speciesId);
  const [failed, setFailed] = useState(false);
  const [useRemote, setUseRemote] = useState(false);
  const meta = TYPE_META[species.type];
  const color = meta.color;
  const fin = finish ? FINISH_META[finish] : null;

  return (
    <div
      className={'poke-sprite' + (fin ? ' ' + fin.cls : '')}
      style={{ width: size, height: size, borderColor: color, boxShadow: `0 0 8px ${color}99` }}
      title={`${species.displayName} · ${meta.label}${fin ? ' · ' + fin.label : ''}`}
    >
      {failed ? (
        <div className="poke-fallback" style={{ background: color }}>
          {species.displayName.slice(0, 2)}
        </div>
      ) : (
        <img
          src={useRemote ? remoteSpriteUrl(species.dexId) : spriteUrl(species.dexId)}
          alt={species.displayName}
          draggable={false}
          onError={() => (useRemote ? setFailed(true) : setUseRemote(true))}
          loading="lazy"
        />
      )}
      {showType && (
        <span className="poke-type" style={{ background: color }}>
          {meta.emoji}
        </span>
      )}
      {fin && <span className="poke-finish">{fin.emoji}</span>}
      {showTier && (
        <span className="poke-level" style={{ background: color }}>
          {species.tier}
        </span>
      )}
    </div>
  );
}


