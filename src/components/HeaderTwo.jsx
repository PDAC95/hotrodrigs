"use client";
import React, { Suspense, useEffect, useState } from "react";
import query from "jquery";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "select2/dist/css/select2.min.css";
import MyTruckSelector from "@/components/fitment/MyTruckSelector";
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
  const [activeIndex, setActiveIndex] = useState(null);
  const handleMenuClick = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };
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
    // Re-read the truck param live (it may have changed since mount).
    const live =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("truck_model")
        : activeTruckModel;
    if (live) params.set("truck_model", live);
    const qs = params.toString();
    window.location.href = qs ? `/search?${qs}` : "/search";
  };

  // category control support
  const [activeCategory, setActiveCategory] = useState(false);
  const handleCategoryToggle = () => {
    setActiveCategory(!activeCategory);
  };
  const [activeIndexCat, setActiveIndexCat] = useState(null);
  const handleCatClick = (index) => {
    setActiveIndexCat(activeIndexCat === index ? null : index);
  };

  return (
    <>
      <div className='overlay' />
      <div
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
          onClick={() => {
            handleMenuToggle();
            setActiveIndex(null);
          }}
          type='button'
          className='close-button'
        >
          <i className='ph ph-x' />{" "}
        </button>
        <div className='mobile-menu__inner'>
          <Link href='/' className='mobile-menu__logo'>
            <img src='/assets/images/logo/logo.png' alt='Logo' />
          </Link>
          <div className='mobile-menu__menu'>
            {/* Nav Menu Start */}
            <ul className='nav-menu flex-align nav-menu--mobile'>
              <li className='nav-menu__item'>
                <Link
                  onClick={() => setActiveIndex(null)}
                  href='/'
                  className='nav-menu__link'
                >
                  Home
                </Link>
              </li>
              <li
                onClick={() => handleMenuClick(0)}
                className={`on-hover-item nav-menu__item has-submenu ${
                  activeIndex === 0 ? "d-block" : ""
                }`}
              >
                <Link href='#' className='nav-menu__link'>
                  Pages
                </Link>
                <ul
                  className={`on-hover-dropdown common-dropdown nav-submenu scroll-sm ${
                    activeIndex === 0 ? "open" : ""
                  }`}
                >
                  <li className='common-dropdown__item nav-submenu__item'>
                    <Link
                      onClick={() => setActiveIndex(null)}
                      href='/cart'
                      className='common-dropdown__link nav-submenu__link hover-bg-neutral-100'
                    >
                      {" "}
                      Cart
                    </Link>
                  </li>
                  <li className='common-dropdown__item nav-submenu__item'>
                    <Link
                      onClick={() => setActiveIndex(null)}
                      href='/checkout'
                      className='common-dropdown__link nav-submenu__link hover-bg-neutral-100'
                    >
                      Checkout
                    </Link>
                  </li>
                  <li className='common-dropdown__item nav-submenu__item'>
                    <Link
                      onClick={() => setActiveIndex(null)}
                      href='/account'
                      className='common-dropdown__link nav-submenu__link hover-bg-neutral-100'
                    >
                      Account
                    </Link>
                  </li>
                </ul>
              </li>
              <li className='nav-menu__item'>
                <Link href='/contact' className='nav-menu__link'>
                  Contact Us
                </Link>
              </li>
            </ul>
            {/* Nav Menu End */}
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
                  <select
                    defaultValue={1}
                    className='js-example-basic-single border border-gray-200 border-end-0 rounded-0 border-0'
                    name='state'
                  >
                    <option value={1}>All Categories</option>
                    <option value={1}>Grocery</option>
                    <option value={1}>Breakfast &amp; Dairy</option>
                    <option value={1}>Vegetables</option>
                    <option value={1}>Milks and Dairies</option>
                    <option value={1}>Pet Foods &amp; Toy</option>
                    <option value={1}>Breads &amp; Bakery</option>
                    <option value={1}>Fresh Seafood</option>
                    <option value={1}>Fronzen Foods</option>
                    <option value={1}>Noodles &amp; Rice</option>
                    <option value={1}>Ice Cream</option>
                  </select>
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
              {/* My Truck selector — global, persistent fitment context (SRCH-03) */}
              <Suspense fallback={null}>
                <MyTruckSelector />
              </Suspense>
            </div>
            {/* form Category start */}
            {/* Header Middle Right start */}
            <div className='header-right flex-align d-lg-block d-none'>
              <div className='header-two-activities flex-align flex-wrap gap-32'>
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
            <div className='flex-align menu-category-wrapper'>
              {/* Category Dropdown Start */}
              <div
                className={`category-two ${
                  category === false ? "d-block" : "d-none"
                } `}
              >
                <button
                  onClick={handleCategoryToggle}
                  type='button'
                  className='category__button flex-align gap-8 fw-medium bg-main-two-600 p-16 text-white'
                >
                  <span className='icon text-2xl d-xs-flex d-none'>
                    <i className='ph ph-dots-nine' />
                  </span>
                  <span className='d-sm-flex d-none'>All</span> Categories
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
                    onClick={() => {
                      handleCategoryToggle();
                      setActiveIndexCat(null);
                    }}
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
              <div
                className={`category main  on-hover-item bg-main-600 text-white ${
                  category === true ? "d-block" : "d-none"
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
              {/* Menu Start  */}
              <div className='header-menu d-lg-block d-none'>
                {/* Nav Menu Start */}
                <ul className='nav-menu flex-align '>
                  <li className='nav-menu__item'>
                    <Link
                      href='/'
                      scroll={false}
                      className={`nav-menu__link ${
                        pathname == "/" && "activePage"
                      } `}
                    >
                      Home
                    </Link>
                  </li>
                  <li className='on-hover-item nav-menu__item has-submenu'>
                    <Link href='#' className='nav-menu__link'>
                      Pages
                    </Link>
                    <ul className='on-hover-dropdown common-dropdown nav-submenu scroll-sm'>
                      <li className='common-dropdown__item nav-submenu__item'>
                        <Link
                          href='/cart'
                          scroll={false}
                          className={`common-dropdown__link nav-submenu__link hover-bg-neutral-100 ${
                            pathname == "/cart" && "activePage"
                          } `}
                        >
                          Cart
                        </Link>
                      </li>
                      <li className='common-dropdown__item nav-submenu__item'>
                        <Link
                          href='/checkout'
                          scroll={false}
                          className={`common-dropdown__link nav-submenu__link hover-bg-neutral-100 ${
                            pathname == "/checkout" && "activePage"
                          } `}
                        >
                          Checkout
                        </Link>
                      </li>
                      <li className='common-dropdown__item nav-submenu__item'>
                        <Link
                          href='/account'
                          scroll={false}
                          className={`common-dropdown__link nav-submenu__link hover-bg-neutral-100 ${
                            pathname == "/account" && "activePage"
                          } `}
                        >
                          Account
                        </Link>
                      </li>
                    </ul>
                  </li>
                  <li className='nav-menu__item'>
                    <Link
                      href='/contact'
                      scroll={false}
                      className={`nav-menu__link ${
                        pathname == "/contact" && "activePage"
                      } `}
                    >
                      Contact Us
                    </Link>
                  </li>
                </ul>
                {/* Nav Menu End */}
              </div>
              {/* Menu End  */}
            </div>
            {/* Header Right start */}
            <div className='header-right flex-align'>
              <div className='me-8 d-lg-none d-block'>
                <div className='header-two-activities flex-align flex-wrap gap-32'>
                  <button
                    onClick={handleSearchToggle}
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
      </header>
      {/* ==================== Header End Here ==================== */}
    </>
  );
};

export default HeaderTwo;
