document.addEventListener("input", (event) => {
  const input = event.target.closest("[data-filter-input]");
  if (!input) return;

  const target = input.getAttribute("data-filter-target");
  const scope = document.querySelector(`[data-filter-table="${target}"]`);
  if (!scope) return;

  const query = input.value.trim().toLowerCase();
  const items = scope.matches("table")
    ? scope.querySelectorAll("tbody tr")
    : scope.querySelectorAll("[data-search]");

  items.forEach((item) => {
    const text = (item.getAttribute("data-search") || item.textContent || "").toLowerCase();
    item.hidden = query.length > 0 && !text.includes(query);
  });
});
