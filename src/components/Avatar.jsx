export default function Avatar({ name = '?', size = 44 }) {
  const letter = (name.trim()[0] || '?').toUpperCase();
  // Простейший детерминированный выбор оттенка по названию.
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  const gradient = `linear-gradient(135deg, hsl(${hash}, 70%, 62%), hsl(${(hash + 40) % 360}, 75%, 52%))`;

  return (
    <div
      className="avatar"
      style={{ width: size, height: size, backgroundImage: gradient, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {letter}
    </div>
  );
}