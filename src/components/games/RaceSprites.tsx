export function RunnerSprite({
  color,
  laneNumber,
  paused,
}: {
  color: string;
  laneNumber: number;
  paused: boolean;
}) {
  const pauseClass = paused ? 'anim-paused' : '';

  return (
    <svg
      viewBox="0 0 64 56"
      className="w-14 h-12 shrink-0 drop-shadow-sm overflow-visible"
      aria-hidden="true"
    >
      {/* Speed wind lines when actively running */}
      {!paused && (
        <g stroke="#ffffff" strokeOpacity="0.65" strokeWidth="1.8" strokeLinecap="round">
          <line x1="2" y1="20" x2="12" y2="20" />
          <line x1="0" y1="27" x2="10" y2="27" />
          <line x1="4" y1="34" x2="13" y2="34" />
        </g>
      )}

      {/* Ground shadow */}
      <ellipse cx="30" cy="52" rx="13" ry="2.5" fill="#064e3b" fillOpacity="0.45" />

      <g className={`runner-body ${pauseClass}`}>
        {/* BACK ARM (darker skin tone for clear depth) */}
        <g
          className={`runner-arm-back ${pauseClass}`}
          style={{ transformOrigin: '31px 19px' }}
        >
          <path
            d="M31 19 L25 27"
            stroke="#c88a55"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M25 27 L31 31"
            stroke="#c88a55"
            strokeWidth="3.6"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="32" cy="31.5" r="2.2" fill="#c88a55" />
        </g>

        {/* BACK LEG (thigh + articulated knee + calf + shoe) */}
        <g
          className={`runner-leg-back ${pauseClass}`}
          style={{ transformOrigin: '29px 32px' }}
        >
          <path d="M29 32 L26 39" stroke="#1e293b" strokeWidth="5.4" strokeLinecap="round" />
          <path d="M27 36 L25 41" stroke="#c88a55" strokeWidth="4.2" strokeLinecap="round" />
          <g
            className={`runner-knee-back ${pauseClass}`}
            style={{ transformOrigin: '25px 41px' }}
          >
            <path d="M25 41 L21 49" stroke="#c88a55" strokeWidth="3.8" strokeLinecap="round" />
            <path
              d="M20 48.5 L26.5 49.5 C27.5 49.7 27.5 51.5 26 51.5 L19.5 51.2 Z"
              fill="#334155"
              stroke="#ffffff"
              strokeWidth="0.9"
            />
          </g>
        </g>

        {/* TORSO & SHORTS */}
        <path
          d="M27 16 L36 16 L33 32 L26 32 Z"
          fill={color}
          stroke="#ffffff"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <text
          x="31"
          y="26.5"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="8"
          fontWeight="800"
          fontFamily="monospace"
        >
          {laneNumber}
        </text>
        <path d="M26 30 L33.5 30 L34 36 L25.5 36 Z" fill="#0f172a" />

        {/* HEAD & HEADBAND */}
        <circle cx="33.5" cy="9.5" r="5.5" fill="#f3be8d" stroke="#7c2d12" strokeWidth="0.7" />
        <path
          d="M28 9 C28 5 32 3.5 36.5 4.8 C38.5 5.4 39.2 7.2 38.6 8.5 C36 7 31.5 7 28 9 Z"
          fill="#1e293b"
        />
        <path d="M28.2 8.2 L38.6 7.8" stroke={color} strokeWidth="2.1" strokeLinecap="round" />
        <circle cx="36.2" cy="9.8" r="0.8" fill="#0f172a" />

        {/* FRONT LEG */}
        <g
          className={`runner-leg-front ${pauseClass}`}
          style={{ transformOrigin: '30px 32px' }}
        >
          <path d="M30 32 L32 38" stroke="#0f172a" strokeWidth="5.6" strokeLinecap="round" />
          <path d="M31 35 L33 41" stroke="#f3be8d" strokeWidth="4.4" strokeLinecap="round" />
          <g
            className={`runner-knee-front ${pauseClass}`}
            style={{ transformOrigin: '33px 41px' }}
          >
            <path d="M33 41 L29 49" stroke="#f3be8d" strokeWidth="4" strokeLinecap="round" />
            <path
              d="M28 48.5 L35.5 49.5 C36.6 49.7 36.5 51.6 34.8 51.6 L27.5 51.3 Z"
              fill={color}
              stroke="#ffffff"
              strokeWidth="1.1"
            />
          </g>
        </g>

        {/* FRONT ARM */}
        <g
          className={`runner-arm-front ${pauseClass}`}
          style={{ transformOrigin: '31px 19px' }}
        >
          <path d="M31 19 L34 23" stroke={color} strokeWidth="5.2" strokeLinecap="round" />
          <path d="M33 22 L35 27" stroke="#f3be8d" strokeWidth="4.1" strokeLinecap="round" />
          <path d="M35 27 L41 25" stroke="#f3be8d" strokeWidth="3.8" strokeLinecap="round" />
          <circle cx="42" cy="24.5" r="2.3" fill="#f3be8d" stroke="#7c2d12" strokeWidth="0.5" />
        </g>
      </g>
    </svg>
  );
}

export function HorseRiderSprite({
  jerseyColor,
  laneNumber,
  turbo,
  paused,
}: {
  jerseyColor: string;
  laneNumber: number;
  turbo: boolean;
  paused: boolean;
}) {
  const pauseClass = paused ? 'anim-paused' : '';
  const rigClass = turbo ? 'horse-rig-turbo' : 'horse-rig';

  return (
    <svg
      viewBox="0 0 92 64"
      className="w-20 h-14 shrink-0 drop-shadow-sm overflow-visible"
      aria-hidden="true"
    >
      {/* Speed wind lines on Pacu Cepat */}
      {turbo && !paused && (
        <g stroke="#fde047" strokeWidth="2" strokeLinecap="round">
          <line x1="-2" y1="18" x2="12" y2="18" />
          <line x1="-5" y1="26" x2="10" y2="26" />
          <line x1="0" y1="34" x2="13" y2="34" />
        </g>
      )}

      {/* Ground shadow */}
      <ellipse cx="44" cy="59" rx="22" ry="3" fill="#1a2e05" fillOpacity="0.45" />

      <g className={`${rigClass} ${pauseClass}`}>
        {/* FLOWING HORSE TAIL */}
        <g className={`horse-tail ${pauseClass}`} style={{ transformOrigin: '21px 33px' }}>
          <path d="M21 33 C12 31 7 37 5 44 C10 43 15 39 21 37 Z" fill="#29170b" />
        </g>

        {/* FAR LEGS */}
        <g className={`horse-leg-fr ${pauseClass}`} style={{ transformOrigin: '55px 40px' }}>
          <path d="M55 40 L60 50 L64 56" stroke="#6d3310" strokeWidth="4.2" strokeLinecap="round" fill="none" />
          <ellipse cx="64.5" cy="56.5" rx="2.3" ry="1.5" fill="#1e293b" />
        </g>
        <g className={`horse-leg-br ${pauseClass}`} style={{ transformOrigin: '27px 41px' }}>
          <path d="M27 41 L23 50 L19 56" stroke="#6d3310" strokeWidth="4.4" strokeLinecap="round" fill="none" />
          <ellipse cx="18.5" cy="56.5" rx="2.3" ry="1.5" fill="#1e293b" />
        </g>

        {/* HORSE BODY, NECK & HEAD */}
        <path
          d="M22 33 C28 29 50 29 58 32 C62 34 61 42 54 43 L27 43 C21 43 19 37 22 33 Z"
          fill="#9a4a18"
          stroke="#451a03"
          strokeWidth="0.9"
        />
        <path
          d="M53 33 L65 18 C67 16 70 16 72 18 L79 24 C80.5 25.5 79.5 28 77 28.2 L71 27 L62 39 Z"
          fill="#9a4a18"
          stroke="#451a03"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        <path d="M52 31 L63 17 C60 17 53 23 49 30 Z" fill="#29170b" />
        <path d="M66 17 L68 11 L71 16 Z" fill="#9a4a18" stroke="#451a03" strokeWidth="0.7" />
        <circle cx="71.5" cy="21" r="1" fill="#0f172a" />
        <path d="M74 22 L76 27.5" stroke="#1e293b" strokeWidth="1.2" />

        {/* NEAR LEGS */}
        <g className={`horse-leg-fl ${pauseClass}`} style={{ transformOrigin: '54px 41px' }}>
          <path d="M54 41 L61 49 L67 55" stroke="#b45309" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <ellipse cx="67.5" cy="55.5" rx="2.5" ry="1.6" fill="#0f172a" />
        </g>
        <g className={`horse-leg-bl ${pauseClass}`} style={{ transformOrigin: '26px 41px' }}>
          <path d="M26 41 L20 49 L15 55" stroke="#b45309" strokeWidth="4.7" strokeLinecap="round" fill="none" />
          <ellipse cx="14.5" cy="55.5" rx="2.5" ry="1.6" fill="#0f172a" />
        </g>

        {/* SADDLE BLANKET & SADDLE */}
        <path
          d="M32 30 L48 30 L46 39 L30 39 Z"
          fill={jerseyColor}
          stroke="#ffffff"
          strokeWidth="1.1"
        />
        <text
          x="39"
          y="37"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="7"
          fontWeight="800"
          fontFamily="monospace"
        >
          {laneNumber}
        </text>
        <path d="M35 28.5 C38 30.5 43 30.5 46 28.5 L45 31.5 L36 31.5 Z" fill="#29170b" />

        {/* JOCKEY RIDER */}
        <g className={`jockey-leg ${pauseClass}`} style={{ transformOrigin: '41px 28px' }}>
          <path d="M40 27.5 L47 32.5" stroke="#f8fafc" strokeWidth="4.4" strokeLinecap="round" />
          <path d="M47 32.5 L43 39.5" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
          <path d="M42.5 39.5 L47.5 40.5" stroke="#0f172a" strokeWidth="3.2" strokeLinecap="round" />
          <rect x="42.5" y="38.5" width="3.5" height="3" fill="none" stroke="#cbd5e1" strokeWidth="1" />
        </g>

        <g className={`jockey-torso ${pauseClass}`} style={{ transformOrigin: '40px 28px' }}>
          <path
            d="M36 27 L41 16 L48 18 L43 28.5 Z"
            fill={jerseyColor}
            stroke="#ffffff"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
          <circle cx="46.5" cy="12" r="4.4" fill="#f3be8d" stroke="#7c2d12" strokeWidth="0.6" />
          <path
            d="M42 11.5 C42 7.2 46 6.2 50 8 C51.2 8.6 51.5 10.5 51 11.2 L53.5 11.5 L42 11.5 Z"
            fill={jerseyColor}
            stroke="#ffffff"
            strokeWidth="0.9"
          />
          <circle cx="49" cy="12.6" r="0.7" fill="#0f172a" />

          <g className={`jockey-arm ${pauseClass}`} style={{ transformOrigin: '45px 18px' }}>
            <path d="M45 18 L49 21" stroke={jerseyColor} strokeWidth="4.2" strokeLinecap="round" />
            <path d="M48.5 21 L56 22.5" stroke="#f3be8d" strokeWidth="3.4" strokeLinecap="round" />
            <circle cx="57" cy="22.8" r="2.2" fill="#f8fafc" stroke="#0f172a" strokeWidth="0.8" />
            <path d="M58 23 L74 26" stroke="#1e293b" strokeWidth="1.2" />
          </g>
        </g>
      </g>
    </svg>
  );
}
