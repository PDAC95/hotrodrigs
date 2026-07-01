import Link from "next/link";
import { signOut } from "@/lib/auth/actions";

// Logged-in account view. Welcome card + logout (posts to the signOut Server
// Action). Server Component — no client state needed.
const AccountDashboard = ({ email }) => {
  return (
    <div className='border border-gray-100 rounded-16 px-24 py-40'>
      <h6 className='text-xl mb-16'>My account</h6>
      <p className='text-gray-500 mb-32'>
        You are signed in as <span className='fw-semibold'>{email}</span>.
      </p>
      <div className='mb-32'>
        <Link
          href='/account/orders'
          className='btn btn-outline-main py-18 px-40'
        >
          My orders
        </Link>
      </div>
      <form action={signOut}>
        <button type='submit' className='btn btn-main py-18 px-40'>
          Log out
        </button>
      </form>
    </div>
  );
};

export default AccountDashboard;
