import HeaderTwo from "@/components/HeaderTwo";
import FooterTwo from "@/components/FooterTwo";
import BottomFooter from "@/components/BottomFooter";
import Breadcrumb from "@/components/Breadcrumb";
import ColorInit from "@/helper/ColorInit";
import ScrollToTopInit from "@/helper/ScrollToTopInit";
import AdminNav from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/admin/guard";

export const metadata = {
  title: "Admin",
};

// Protected admin shell (ADM-01). Because Next nests layouts, awaiting
// requireAdmin() here as the FIRST thing gates the ENTIRE /admin/** subtree in
// one place — if it redirects, children never render (no admin chrome flash).
// getClaims() makes this route dynamic (ƒ). Downstream plans (08-02/03/04) hang
// their section pages off this shell and never re-implement the auth gate.
const AdminLayout = async ({ children }) => {
  await requireAdmin();

  return (
    <>
      <ColorInit color={true} />
      <ScrollToTopInit color='#FA6400' />
      <HeaderTwo category={true} />
      <Breadcrumb title={"Admin"} />

      <section className='py-80'>
        <div className='container container-lg'>
          <div className='row gy-4'>
            <div className='col-lg-3'>
              <AdminNav />
            </div>
            <div className='col-lg-9'>{children}</div>
          </div>
        </div>
      </section>

      <FooterTwo />
      <BottomFooter />
    </>
  );
};

export default AdminLayout;
