"use client";

import Link from "next/link";
import { useRef } from "react";
import { signIn, signInWithGoogle } from "@/lib/auth/actions";
import { getGuestCart } from "@/lib/cart/guest-store";

// Login card (markup reused from Account.jsx). Real form posting to the signIn
// Server Action — inputs MUST be name="email" / name="password" (the action
// reads FormData by those keys). A second form drives "Continue with Google".
const LoginForm = ({ error }) => {
  // Forward the localStorage guest cart to the signIn action so the server-side
  // merge fires on a real login. React Server-Action forms still run onSubmit
  // before the action, so we stamp the current guest cart into a hidden field.
  const guestCartRef = useRef(null);
  const onSubmit = () => {
    if (guestCartRef.current) {
      guestCartRef.current.value = JSON.stringify(getGuestCart());
    }
  };

  return (
    <div className='border border-gray-100 hover-border-main-600 transition-1 rounded-16 px-24 py-40 h-100'>
      <h6 className='text-xl mb-32'>Login</h6>

      {error ? (
        <div className='text-danger bg-danger-50 border border-danger-200 rounded-8 px-16 py-12 mb-24 text-sm'>
          {error}
        </div>
      ) : null}

      <form action={signIn} onSubmit={onSubmit}>
        <input type='hidden' name='guest_cart' ref={guestCartRef} />
        <div className='mb-24'>
          <label
            htmlFor='email'
            className='text-neutral-900 text-lg mb-8 fw-medium'
          >
            Email address <span className='text-danger'>*</span>
          </label>
          <input
            type='email'
            name='email'
            className='common-input'
            id='email'
            placeholder='Enter Email Address'
            required
          />
        </div>
        <div className='mb-24'>
          <label
            htmlFor='password'
            className='text-neutral-900 text-lg mb-8 fw-medium'
          >
            Password <span className='text-danger'>*</span>
          </label>
          <div className='position-relative'>
            <input
              type='password'
              name='password'
              className='common-input'
              id='password'
              placeholder='Enter Password'
              required
            />
          </div>
        </div>
        <div className='mb-24 mt-48'>
          <div className='flex-align gap-48 flex-wrap'>
            <button type='submit' className='btn btn-main py-18 px-40'>
              Log in
            </button>
            <div className='form-check common-check'>
              <input
                className='form-check-input'
                type='checkbox'
                defaultValue=''
                id='remember'
              />
              <label
                className='form-check-label flex-grow-1'
                htmlFor='remember'
              >
                Remember me
              </label>
            </div>
          </div>
        </div>
      </form>

      <div className='mt-32'>
        <form action={signInWithGoogle}>
          <button
            type='submit'
            className='btn btn-outline-main py-18 px-40 w-100 flex-center gap-8'
          >
            <i className='ph ph-google-logo text-xl' />
            Continue with Google
          </button>
        </form>
      </div>

      <div className='mt-32'>
        <Link
          href='#'
          className='text-danger-600 text-sm fw-semibold hover-text-decoration-underline'
        >
          Forgot your password?
        </Link>
      </div>
    </div>
  );
};

export default LoginForm;
