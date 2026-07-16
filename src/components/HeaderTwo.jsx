"use client";
import React, { Suspense, useEffect, useRef, useState } from "react";
import query from "jquery";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "select2/dist/css/select2.min.css";
import MyTruckMenu from "@/components/fitment/MyTruckMenu";
import CategoryScopeSelect from "@/components/nav/CategoryScopeSelect";
import StickyCategoryMenu from "@/components/nav/StickyCategoryMenu";
import MobileCategoryList from "@/components/nav/MobileCategoryList";
import { TRUCK_AREAS } from "@/lib/catalog/areas";
import MegaMenuList from "@/components/nav/MegaMenuList";
import { useCart } from "@/components/cart/CartProvider";
const HeaderTwo = ({ category, categoryTree = [] }) => {
  let pathname = usePathname();
  // Real cart badge (CART-03). Hydration-safe: render nothing until mounted so
  // SSR (no localStorage / no auth) and the first client paint agree.
  const { count, mounted } = useCart();
  const cartBadge = mounted ? count : "";
  const [scroll, setScroll] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleScroll = () => {
        setScroll(window.pageYOffset > 150);
      };

      // Attach the scroll event listener
      window.addEventListener("scroll", handleScroll);

      // Initialize Select2
      const selectElement = query(".js-example-basic-single");
      selectElement.select2();

      // Cleanup function
      return () => {
        // Remove the scroll event listener
        window.removeEventListener("scroll", handleScroll);

        // Destroy Select2 instance if it exists
        if (selectElement.data("select2")) {
          selectElement.select2("destroy");
        }
      };
    }
  }, []);

  // Mobile menu support
  const [menuActive, setMenuActive] = useState(false);
  const handleMenuToggle = () => {
    setMenuActive(!menuActive);
  };

  // Search control support
  const [activeSearch, setActiveSearch] = useState(false);
  const handleSearchToggle = () => {
    setActiveSearch(!activeSearch);
  };

  // Active truck for search context. Read from the URL after mount (no
  // useSearchParams here — that would force the whole header into a Suspense
  // boundary; the truck param is only needed when the customer submits a search).
  const [activeTruckModel, setActiveTruckModel] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setActiveTruckModel(params.get("truck_model") ?? "");
  }, [pathname]);

  // Submit either search form to /search?q=..., preserving the active truck so
  // results respect the customer's current My-Truck selection (SRCH-01/03).
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const input = e.currentTarget.querySelector('input[name="q"]');
    const q = input ? input.value.trim() : "";
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    // Category scope from the header select (real L1 ids; "" = all categories).
    const catSelect = e.currentTarget.querySelector('select[name="category"]');
    if (catSelect && catSelect.value) params.set("category", catSelect.value);
    // Re-read the truck param live (it may have changed since mount).
    const live =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("truck_model")
        : activeTruckModel;
    if (live) params.set("truck_model", live);
    const qs = params.toString();
    window.location.href = qs ? `/search?${qs}` : "/search";
  };

  // Sticky-bar search band (desktop): slides down under the fixed bar.
  const [stickySearchOpen, setStickySearchOpen] = useState(false);
  const stickySearchRef = useRef(null);
  useEffect(() => {
    if (stickySearchOpen) stickySearchRef.current?.focus();
  }, [stickySearchOpen]);
  // Leaving the sticky state collapses the band.
  useEffect(() => {
    if (!scroll) setStickySearchOpen(false);
  }, [scroll]);

  // category control support
  const [activeCategory, setActiveCategory] = useState(false);
  const handleCategoryToggle = () => {
    setActiveCategory(!activeCategory);
  };
  // Any open drawer closes on outside click (overlay) or Escape.
  const closeDrawers = () => {
    setMenuActive(false);
    setActiveCategory(false);
  };
  useEffect(() => {
    if (!menuActive && !activeCategory) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeDrawers();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuActive, activeCategory]);

  return (
    <>
      <div className='overlay' />
      <div
        onClick={closeDrawers}
        className={`side-overlay ${(menuActive || activeCategory) && "show"}`}
      />
      {/* ==================== Search Box Start Here ==================== */}

      <form
        action='/search'
        method='get'
        onSubmit={handleSearchSubmit}
        className={`search-box ${activeSearch && "active"}`}
      >
        <button
          onClick={handleSearchToggle}
          type='button'
          className='search-box__close position-absolute inset-block-start-0 inset-inline-end-0 m-16 w-48 h-48 border border-gray-100 rounded-circle flex-center text-white hover-text-gray-800 hover-bg-white text-2xl transition-1'
        >
          <i className='ph ph-x' />
        </button>
        <div className='container'>
          <div className='position-relative'>
            <input
              type='text'
              name='q'
              className='form-control py-16 px-24 text-xl rounded-pill pe-64'
              placeholder='Search for a part, brand, or OEM number'
            />
            <button
              type='submit'
              className='w-48 h-48 bg-main-600 rounded-circle flex-center text-xl text-white position-absolute top-50 translate-middle-y inset-inline-end-0 me-8'
            >
              <i className='ph ph-magnifying-glass' />
            </button>
          </div>
        </div>
      </form>
      {/* ==================== Search Box End Here ==================== */}
      {/* ==================== Mobile Menu Start Here ==================== */}
      <div
        className={`mobile-menu scroll-sm d-lg-none d-block ${
          menuActive && "active"
        }`}
      >
        <button
          onClick={handleMenuToggle}
          type='button'
          className='close-button'
        >
          <i className='ph ph-x' />{" "}
        </button>
        <div className='mobile-menu__inner'>
          <Link
            href='/'
            className='mobile-menu__logo'
            onClick={() => setMenuActive(false)}
          >
            <img src='/assets/images/logo/logo.png' alt='Logo' />
          </Link>
          {/* Truck + account + search — navigation lives in the left drawer. */}
          <div className='hrr-mmenu'>
            <Suspense fallback={null}>
              <MyTruckMenu inline />
            </Suspense>
            <div className='hrr-mmenu__tiles'>
              <Link
                href='/account'
                className='hrr-mmenu__tile'
                onClick={() => setMenuActive(false)}
              >
                <span className='hrr-mmenu__tile-icon'>
                  <i className='ph ph-user' />
                </span>
                <span>Profile</span>
              </Link>
            </div>
            <Link
              href='/search'
              className='hrr-mmenu__all'
              onClick={() => setMenuActive(false)}
            >
              Shop all parts
              <i className='ph ph-arrow-right' />
            </Link>
          </div>
        </div>
      </div>
      {/* ==================== Mobile Menu End Here ==================== */}
      {/* ======================= Middle Header Two Start ========================= */}
      <header className='header-middle style-two bg-color-neutral'>
        <div className='container container-lg'>
          <nav className='header-inner flex-between'>
            {/* Logo Start */}
            <div className='logo'>
              <Link href='/' className='link'>
                <img src='/assets/images/logo/logo-two.png' alt='Logo' />
              </Link>
            </div>
            {/* Logo End  */}
            {/* form Category Start */}
            <div className='flex-align gap-16'>
              <form
                action='/search'
                method='get'
                onSubmit={handleSearchSubmit}
                className='flex-align flex-wrap form-location-wrapper'
              >
                <div className='search-category style-two d-flex h-48 search-form d-sm-flex d-none'>
                  <CategoryScopeSelect categories={categoryTree} />
                  <div className='search-form__wrapper position-relative'>
                    <input
                      type='text'
                      name='q'
                      className='search-form__input common-input py-13 ps-16 pe-18 rounded-0 border-0'
                      placeholder='Search for a part, brand, or OEM number'
                    />
                  </div>
                  <button
                    type='submit'
                    className='bg-main-two-600 flex-center text-xl text-white flex-shrink-0 w-48 hover-bg-main-two-700 d-lg-flex d-none'
                  >
                    <i className='ph ph-magnifying-glass' />
                  </button>
                </div>
              </form>
            </div>
            {/* form Category start */}
            {/* Header Middle Right start */}
            <div className='header-right flex-align d-lg-block d-none'>
              <div className='header-two-activities flex-align flex-wrap gap-32'>
                {/* My Truck icon + dropdown — global, persistent fitment context (SRCH-03) */}
                <Suspense fallback={null}>
                  <MyTruckMenu />
                </Suspense>
                <button
                  type='button'
                  className='flex-align search-icon d-lg-none d-flex gap-4 item-hover-two'
                >
                  <span className='text-2xl text-white d-flex position-relative item-hover__text'>
                    <i className='ph ph-magnifying-glass' />
                  </span>
                </button>
                <Link
                  href='/account'
                  className='flex-align flex-column gap-8 item-hover-two'
                >
                  <span className='text-2xl text-white d-flex position-relative item-hover__text'>
                    <i className='ph ph-user' />
                  </span>
                  <span className='text-md text-white item-hover__text d-none d-lg-flex'>
                    Profile
                  </span>
                </Link>
                <Link
                  href='/cart'
                  className='flex-align flex-column gap-8 item-hover-two'
                >
                  <span className='text-2xl text-white d-flex position-relative me-6 mt-6 item-hover__text'>
                    <i className='ph ph-shopping-cart-simple' />
                    <span
                      suppressHydrationWarning
                      className='w-16 h-16 flex-center rounded-circle bg-main-two-600 text-white text-xs position-absolute top-n6 end-n4'
                    >
                      {cartBadge}
                    </span>
                  </span>
                  <span className='text-md text-white item-hover__text d-none d-lg-flex'>
                    Cart
                  </span>
                </Link>
              </div>
            </div>
            {/* Header Middle Right End  */}
          </nav>
        </div>
      </header>
      {/* ======================= Middle Header Two End ========================= */}
      {/* ==================== Header Two Start Here ==================== */}
      <header
        className={`header bg-white border-bottom border-gray-100 ${
          scroll && "fixed-header"
        }`}
      >
        <div className='container container-lg'>
          <nav className='header-inner d-flex justify-content-between gap-8'>
            {scroll ? (
              <Link
                href='/'
                className='d-none d-lg-flex align-items-center flex-shrink-0 me-8'
                aria-label='Hot Rod Rigs home'
              >
                <img
                  src='/assets/images/logo/logo-two.png'
                  alt='Hot Rod Rigs'
                  style={{ height: 44, width: "auto" }}
                />
              </Link>
            ) : null}
            <div className='flex-align menu-category-wrapper'>
              {/* Category Dropdown Start */}
              <div
                className={`category-two ${
                  category === false && !scroll ? "d-block" : "d-none"
                } `}
              >
                <button
                  onClick={handleCategoryToggle}
                  type='button'
                  aria-label='Browse parts'
                  aria-expanded={activeCategory}
                  className='category__button flex-align gap-8 fw-medium bg-main-two-600 p-16 text-white'
                >
                  <span className='icon text-2xl d-xs-flex d-none'>
                    <i className='ph ph-dots-nine' />
                  </span>
                  <span className='category__button-text'>All Categories</span>
                  <span className='arrow-icon text-xl d-flex'>
                    <i className='ph ph-caret-down' />
                  </span>
                </button>
                <div
                  className={`responsive-dropdown cat common-dropdown d-lg-none d-block nav-submenu p-0 submenus-submenu-wrapper shadow-none border border-gray-100 ${
                    activeCategory && "active"
                  }`}
                >
                  <button
                    onClick={handleCategoryToggle}
                    type='button'
                    className='close-responsive-dropdown rounded-circle text-xl position-absolute inset-inline-end-0 inset-block-start-0 mt-4 me-8 d-lg-none d-flex'
                  >
                    <i className='ph ph-x' />{" "}
                  </button>
                  <div className='logo px-16 d-lg-none d-block'>
                    <Link href='/' className='link'>
                      <img src='/assets/images/logo/logo.png' alt='Logo' />
                    </Link>
                  </div>
                  {/* In-place view navigator (area/category choice). Keyed by
                      open state so every open starts back at the root. */}
                  <MobileCategoryList
                    key={activeCategory ? "open" : "closed"}
                    tree={categoryTree}
                    onNavigate={() => setActiveCategory(false)}
                  />
                </div>
              </div>
              {/* Sticky-state categories: click-driven twin-panel menu (the
                  home's banner sidebar is off-screen once scrolled). */}
              {scroll ? <StickyCategoryMenu tree={categoryTree} /> : null}
              <div
                className={`category main  on-hover-item bg-main-600 text-white ${
                  category === true && !scroll ? "d-block" : "d-none"
                }`}
              >
                <button
                  type='button'
                  className='category__button flex-align gap-8 fw-medium p-16 border-end border-start border-gray-100 text-white'
                >
                  <span className='icon text-2xl d-xs-flex d-none'>
                    <i className='ph ph-dots-nine' />
                  </span>
                  <span className='d-sm-flex d-none'>All</span> Categories
                  <span className='arrow-icon text-xl d-flex'>
                    <i className='ph ph-caret-down' />
                  </span>
                </button>
                <div className='responsive-dropdown on-hover-dropdown common-dropdown nav-submenu p-0 submenus-submenu-wrapper'>
                  <button
                    type='button'
                    className='close-responsive-dropdown rounded-circle text-xl position-absolute inset-inline-end-0 inset-block-start-0 mt-4 me-8 d-lg-none d-flex'
                  >
                    <i className='ph ph-x' />{" "}
                  </button>
                  <div className='logo px-16 d-lg-none d-block'>
                    <Link href='/' className='link'>
                      <img src='/assets/images/logo/logo.png' alt='Logo' />
                    </Link>
                  </div>
                  <MegaMenuList tree={categoryTree} />
                </div>
              </div>
              {/* Category Dropdown End  */}
              {/* Mobile search — in the bar, next to the categories trigger */}
              <button
                onClick={handleSearchToggle}
                type='button'
                className='hrr-msearch flex-align d-lg-none d-flex'
                aria-label='Search'
              >
                <span className='text-2xl text-white d-flex'>
                  <i className='ph ph-magnifying-glass' />
                </span>
              </button>
              {/* Menu Start  */}
              <div className='header-menu d-lg-block d-none'>
                {/* Nav Menu Start */}
                {/* Truck areas — browse by physical area of the rig
                    (products.area tag; categories stay in All Categories). */}
                <ul className='nav-menu flex-align '>
                  {TRUCK_AREAS.map((area) => (
                    <li key={area.slug} className='nav-menu__item'>
                      <Link
                        href={`/search?area=${area.slug}`}
                        scroll={false}
                        className='nav-menu__link text-nowrap'
                      >
                        {area.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                {/* Nav Menu End */}
              </div>
              {/* Menu End  */}
            </div>
            {/* Header Right start */}
            <div className='header-right flex-align'>
              {/* Sticky-header actions: search + fitment + account + cart stay
                  reachable after the middle header scrolls away. */}
              {scroll ? (
                <div className='d-none d-lg-flex flex-align gap-24 me-4'>
                  <button
                    onClick={() => setStickySearchOpen((o) => !o)}
                    type='button'
                    className='flex-align item-hover-two'
                    aria-label='Search'
                    aria-expanded={stickySearchOpen}
                  >
                    <span className='text-2xl text-white d-flex item-hover__text'>
                      <i
                        className={`ph ${
                          stickySearchOpen ? "ph-x" : "ph-magnifying-glass"
                        }`}
                      />
                    </span>
                  </button>
                  <Suspense fallback={null}>
                    <MyTruckMenu compact />
                  </Suspense>
                  <Link
                    href='/account'
                    className='flex-align item-hover-two'
                    aria-label='Profile'
                  >
                    <span className='text-2xl text-white d-flex item-hover__text'>
                      <i className='ph ph-user' />
                    </span>
                  </Link>
                  <Link
                    href='/cart'
                    className='flex-align item-hover-two'
                    aria-label='Cart'
                  >
                    <span className='text-2xl text-white d-flex position-relative me-6 item-hover__text'>
                      <i className='ph ph-shopping-cart-simple' />
                      <span
                        suppressHydrationWarning
                        className='w-16 h-16 flex-center rounded-circle bg-main-two-600 text-white text-xs position-absolute top-n6 end-n4'
                      >
                        {cartBadge}
                      </span>
                    </span>
                  </Link>
                </div>
              ) : null}
              <div className='me-8 d-lg-none d-block'>
                <div className='header-two-activities flex-align flex-wrap gap-32'>
                  <Link
                    href='/cart'
                    className='flex-align flex-column gap-8 item-hover-two'
                  >
                    <span className='text-2xl text-white d-flex position-relative me-6 mt-6 item-hover__text'>
                      <i className='ph ph-shopping-cart-simple' />
                      <span
                        suppressHydrationWarning
                        className='w-16 h-16 flex-center rounded-circle bg-main-two-600 text-white text-xs position-absolute top-n6 end-n4'
                      >
                        {cartBadge}
                      </span>
                    </span>
                    <span className='text-md text-white item-hover__text d-none d-lg-flex'>
                      Cart
                    </span>
                  </Link>
                </div>
              </div>
              <button
                onClick={handleMenuToggle}
                type='button'
                className='toggle-mobileMenu d-lg-none ms-3n text-gray-800 text-4xl d-flex'
              >
                {" "}
                <i className='ph ph-list' />{" "}
              </button>
            </div>
            {/* Header Right End  */}
          </nav>
        </div>
        {/* Sticky search band — slides down under the bar (desktop) */}
        {scroll ? (
          <div
            className={`hrr-sticky-search d-none d-lg-block ${
              stickySearchOpen ? "is-open" : ""
            }`}
          >
            <div className='container container-lg'>
              <form
                action='/search'
                method='get'
                onSubmit={handleSearchSubmit}
                className='hrr-sticky-search__form'
              >
                <input
                  ref={stickySearchRef}
                  type='text'
                  name='q'
                  className='hrr-sticky-search__input'
                  placeholder='Search for a part, brand, or OEM number'
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setStickySearchOpen(false);
                  }}
                />
                <button type='submit' className='hrr-sticky-search__submit'>
                  <i className='ph ph-magnifying-glass' />
                  Search
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </header>
      {/* ==================== Header End Here ==================== */}
    </>
  );
};

export default HeaderTwo;
