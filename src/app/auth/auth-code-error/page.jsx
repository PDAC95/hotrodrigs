import Link from "next/link";

export const metadata = {
  title: "Authentication error",
};

const AuthCodeErrorPage = () => {
  return (
    <section className='py-120'>
      <div className='container container-lg'>
        <div className='row justify-content-center'>
          <div className='col-md-6 col-sm-8'>
            <div className='border border-gray-100 rounded-16 px-24 py-40 text-center'>
              <h4 className='mb-16'>Authentication error</h4>
              <p className='text-gray-500 mb-32'>
                We could not confirm your sign-in link. It may have expired or
                already been used. Please try logging in again.
              </p>
              <Link href='/login' className='btn btn-main py-18 px-40'>
                Back to login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AuthCodeErrorPage;
