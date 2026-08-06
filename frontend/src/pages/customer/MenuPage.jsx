import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, Minus, ImageOff, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { useCart } from "@/lib/contexts";
import { toast } from "sonner";

export default function MenuPage() {
  const [menu, setMenu] = useState({ items: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState("all");
  const [q, setQ] = useState("");
  const { items: cartItems, add, inc, dec } = useCart();
  const sliderRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    api.get("/menu").then(({ data }) => setMenu(data)).finally(() => setLoading(false));
  }, []);

  const qty = (id) => cartItems.find((i) => i.id === id)?.quantity || 0;

  const filtered = useMemo(() => {
    let arr = menu.items;
    if (active !== "all") arr = arr.filter((m) => m.category_id === active);
    if (q.trim()) {
      const s = q.toLowerCase();
      arr = arr.filter((m) => m.name.toLowerCase().includes(s) || m.description?.toLowerCase().includes(s));
    }
    return arr;
  }, [menu.items, active, q]);

  const slide = (direction) => {
    if (!sliderRef.current) return;
    const amount = direction === "left" ? -260 : 260;
    sliderRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  const handleMouseDown = (e) => {
    if (!sliderRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - sliderRef.current.offsetLeft);
    setScrollLeft(sliderRef.current.scrollLeft);
  };

  const handleMouseLeaveOrUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !sliderRef.current) return;
    e.preventDefault();
    const x = e.pageX - sliderRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    sliderRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleWheel = (e) => {
    if (!sliderRef.current) return;
    if (e.deltaY !== 0 && !e.shiftKey) {
      sliderRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <section className="space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Today&apos;s Menu</div>
        <h1 className="text-4xl sm:text-5xl font-heading tracking-tight leading-none">Order something warm.</h1>
        <p className="text-base text-muted-foreground max-w-xl">Freshly crafted, served straight to your table. Browse, tap, and place your order in seconds.</p>
      </section>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          data-testid="menu-search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search dish or ingredient…"
          className="w-full h-12 pl-11 pr-4 rounded-full bg-card border border-border focus:outline-none focus:ring-2 focus:ring-ring/40 text-sm"
        />
      </div>

      <div className="relative group">
        <button
          type="button"
          onClick={() => slide("left")}
          className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-card/95 border border-border shadow-md grid place-items-center opacity-90 hover:opacity-100 hover:scale-105 transition"
          aria-label="Slide left"
        >
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>

        <div
          ref={sliderRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeaveOrUp}
          onMouseUp={handleMouseLeaveOrUp}
          onMouseMove={handleMouseMove}
          onWheel={handleWheel}
          className={`flex gap-2 overflow-x-auto no-scrollbar py-1 px-1 select-none scroll-smooth ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        >
          <button
            data-testid="cat-btn-all"
            onClick={(e) => {
              setActive("all");
              e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
            }}
            className={`h-10 px-5 rounded-full text-sm font-medium whitespace-nowrap border shrink-0 transition-all ${active === "all" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card border-border hover:bg-secondary"}`}
          >All</button>
          {menu.categories.filter((c) => c.is_active).map((c) => (
            <button
              key={c.id}
              data-testid={`cat-btn-${c.name.toLowerCase()}`}
              onClick={(e) => {
                setActive(c.id);
                e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
              }}
              className={`h-10 px-5 rounded-full text-sm font-medium whitespace-nowrap border shrink-0 transition-all ${active === c.id ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card border-border hover:bg-secondary"}`}
            >{c.name}</button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => slide("right")}
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-card/95 border border-border shadow-md grid place-items-center opacity-90 hover:opacity-100 hover:scale-105 transition"
          aria-label="Slide right"
        >
          <ChevronRight className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">No items match your search.</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((m) => (
            <article
              key={m.id}
              data-testid={`food-card-${m.id}`}
              className="group bg-card border border-border rounded-2xl p-3 flex gap-3 hover:-translate-y-0.5 hover:shadow-md transition-all"
            >
              <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-xl bg-secondary overflow-hidden grid place-items-center">
                {m.image_url ? (
                  <img src={m.image_url} alt={m.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageOff className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-heading text-lg leading-tight">{m.name}</h3>
                  <div className="font-mono text-base whitespace-nowrap">₹{m.price.toFixed(0)}</div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{m.description}</p>
                <div className="mt-auto pt-2 flex items-center justify-between">
                  {m.is_available ? (
                    <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-green-700">In stock</span>
                  ) : (
                    <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-destructive">Unavailable</span>
                  )}
                  {qty(m.id) === 0 ? (
                    <button
                      data-testid={`add-to-cart-${m.id}`}
                      disabled={!m.is_available}
                      onClick={() => { add(m); toast.success(`${m.name} added`); }}
                      className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-95 transition disabled:opacity-40"
                    >Add</button>
                  ) : (
                    <div className="flex items-center gap-2 rounded-full border border-border bg-card">
                      <button data-testid={`dec-${m.id}`} onClick={() => dec(m.id)} className="w-9 h-9 grid place-items-center hover:bg-secondary rounded-l-full"><Minus className="w-4 h-4" /></button>
                      <span data-testid={`qty-${m.id}`} className="min-w-[24px] text-center font-mono">{qty(m.id)}</span>
                      <button data-testid={`inc-${m.id}`} onClick={() => inc(m.id)} className="w-9 h-9 grid place-items-center hover:bg-secondary rounded-r-full"><Plus className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
