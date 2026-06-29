import "server-only";
import { getCategoryTree } from "@/lib/catalog/categories";
import MegaMenuList from "@/components/nav/MegaMenuList";

/**
 * Server seam for the header category mega-menu (BRWS-01).
 * Fetches the real L1 -> L2 tree (one query) and hands it to the presentational
 * list. Pages that mount the client HeaderTwo fetch the tree via getCategoryTree()
 * and pass it down as a prop; this component is the convenience wrapper that does
 * the fetch + render in one server step where a page wants to embed the menu directly.
 */
const MegaMenu = async () => {
  const tree = await getCategoryTree();
  return <MegaMenuList tree={tree} />;
};

export default MegaMenu;
