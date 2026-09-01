export function reconcileCartWithMenu<TMenu extends { id: string }>(
  cart: Array<{ item: TMenu; qty: number }>,
  menuItems: TMenu[],
) {
  if (cart.length === 0) return cart;

  const menuById = new Map(menuItems.map((item) => [item.id, item]));
  let changed = false;
  const nextCart = cart.flatMap((line) => {
    const currentItem = menuById.get(line.item.id);
    if (!currentItem) {
      changed = true;
      return [];
    }
    if (currentItem === line.item) return [line];
    changed = true;
    return [{ ...line, item: currentItem }];
  });

  return changed ? nextCart : cart;
}
