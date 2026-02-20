"use client";

import type {
  CountrySubreddit,
  CitySubreddit,
  PlaceSubreddit,
} from "@/app/data/subreddits";

interface InfoPanelProps {
  country: CountrySubreddit | null;
  city: CitySubreddit | null;
  place: PlaceSubreddit | null;
  onBack: () => void;
  onClose: () => void;
  onCityClick: (city: CitySubreddit) => void;
  onPlaceClick: (place: PlaceSubreddit) => void;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export default function InfoPanel({
  country,
  city,
  place,
  onBack,
  onClose,
  onCityClick,
  onPlaceClick,
}: InfoPanelProps) {
  const isOpen = !!country;

  const active = place ?? city ?? country;
  const subreddit = active?.subreddit;
  const subscribers = active?.subscribers;
  const displayName = active?.name;

  const backLabel = place ? city?.name : city ? country?.name : "World";

  return (
    <div
      className="absolute top-0 right-0 h-full z-[1000] flex flex-col transition-transform duration-300 ease-out"
      style={{
        width: "clamp(280px, 25vw, 360px)",
        background: "rgba(13, 17, 23, 0.94)",
        backdropFilter: "blur(24px)",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={onBack}
          className="text-sm transition-colors"
          style={{ color: "rgba(255,255,255,0.5)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "rgba(255,255,255,0.5)")
          }
        >
          ← {backLabel}
        </button>
        <button
          onClick={onClose}
          className="text-lg leading-none transition-colors"
          style={{ color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "rgba(255,255,255,0.3)")
          }
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <h2 className="text-2xl font-bold text-white mb-0.5">
          r/{subreddit}
        </h2>
        <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>
          {displayName}
        </p>

        <div
          className="inline-flex flex-col px-4 py-2.5 rounded-xl mb-5"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <span
            className="text-xs uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            Members
          </span>
          <span className="text-xl font-semibold text-white">
            {subscribers ? formatCount(subscribers) : "—"}
          </span>
        </div>

        <a
          href={`https://reddit.com/r/${subreddit}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-full py-2.5 rounded-xl font-medium text-white text-sm mb-6 transition-opacity hover:opacity-90"
          style={{ background: "#FF4500" }}
        >
          Visit r/{subreddit} ↗
        </a>

        {!city && !place && country && country.cities.length > 0 && (
          <SubList
            label="Cities"
            items={country.cities}
            onItemClick={onCityClick}
            color="#FF6B35"
          />
        )}

        {city && !place && city.places && city.places.length > 0 && (
          <SubList
            label="Neighborhoods"
            items={city.places}
            onItemClick={onPlaceClick}
            color="#c084fc"
          />
        )}
      </div>
    </div>
  );
}

function SubList<T extends { name: string; subreddit: string; subscribers: number }>({
  label,
  items,
  onItemClick,
  color,
}: {
  label: string;
  items: T[];
  onItemClick: (item: T) => void;
  color: string;
}) {
  return (
    <div>
      <h3
        className="text-xs font-medium uppercase tracking-wider mb-3"
        style={{ color: "rgba(255,255,255,0.3)" }}
      >
        {label} ({items.length})
      </h3>
      <div className="flex flex-col gap-0.5">
        {[...items]
          .sort((a, b) => b.subscribers - a.subscribers)
          .map((item) => (
            <button
              key={item.name}
              onClick={() => onItemClick(item)}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors"
              style={{ background: "transparent" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: color }}
                />
                <div>
                  <div className="text-sm font-medium text-white">
                    r/{item.subreddit}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    {item.name}
                  </div>
                </div>
              </div>
              <div
                className="text-xs"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                {formatCount(item.subscribers)}
              </div>
            </button>
          ))}
      </div>
    </div>
  );
}
