const FAQ = [
  { q: "How do I manage new orders?", a: "Go to Orders. New orders appear at the top. Accept, then progress through Preparing → Ready → Served → Complete. Rejecting an order will not credit any points." },
  { q: "How do I add or edit menu items?", a: "Menu → Add item. Fill in name, description, price, and image URL. You can toggle availability directly from the list." },
  { q: "How does the loyalty points system work?", a: "Registered customers earn 10 points per ₹100 spent on orders that reach Completed status. Guests do not earn points. Points can be redeemed for rewards you configure in the Loyalty tab." },
  { q: "How do I mark items as unavailable?", a: "In Menu, use the 'Available' checkbox on each item. Unavailable items won't show up as orderable on the customer site." },
  { q: "Where do completed orders go?", a: "They move to Order History, where you can filter by date and search by order#, name, mobile or table." },
];

export default function HelpPage() {
  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Help</div>
        <h1 className="text-3xl font-heading">Guides & FAQ</h1>
      </div>
      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {FAQ.map((f, i) => (
          <details key={i} data-testid={`faq-${i}`} className="p-4 group">
            <summary className="cursor-pointer font-medium flex justify-between">
              {f.q}
              <span className="text-muted-foreground text-xs group-open:rotate-180 transition">▾</span>
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="font-heading text-lg mb-1">Need more help?</div>
        <p className="text-sm text-muted-foreground">Email <a className="text-primary underline" href="mailto:support@carolinalounge.com">support@carolinalounge.com</a> or use the Report a Problem button in the corner of your admin dashboard.</p>
      </div>
    </div>
  );
}
