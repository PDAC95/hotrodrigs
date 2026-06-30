"use client";

import Link from "next/link";
import { signUp } from "@/lib/auth/actions";

// Register card (markup reused from Account.jsx). Posts to the signUp Server
// Action; inputs MUST be name="email" / name="password". When checkEmail is true
// (post sign-up redirect) we swap the form for a "check your inbox" success state,
// since email confirmation is required before a session exists.
const RegisterForm = ({ error, checkEmail }) => {
  if (checkEmail) {
    return (
      <div className='border border-gray-100 rounded-16 px-24 py-40 h-100'>
        <h6 className='text-xl mb-24'>Check your inbox</h6>
        <p className='text-gray-500 mb-0'>
          We sent a confirmation link to your email address. Click the link to
          confirm your account and finish signing in.
        </p>
      </div>
    );
  }

  return (
    <div className='border border-gray-100 hover-border-main-600 transition-1 rounded-16 px-24 py-40 h-100'>
      <h6 className='text-xl mb-32'>Register</h6>

      {error ? (
        <div className='text-danger bg-danger-50 border border-danger-200 rounded-8 px-16 py-12 mb-24 text-sm'>
          {error}
        </div>
      ) : null}

      <form action={signUp}>
        <div className='mb-24'>
          <label
            htmlFor='emailTwo'
            className='text-neutral-900 text-lg mb-8 fw-medium'
          >
            Email address <span className='text-danger'>*</span>
          </label>
          <input
            type='email'
            name='email'
            className='common-input'
            id='emailTwo'
            placeholder='Enter Email Address'
            required
          />
        </div>
        <div className='mb-24'>
          <label
            htmlFor='enter-password'
            className='text-neutral-900 text-lg mb-8 fw-medium'
          >
            Password <span className='text-danger'>*</span>
          </label>
          <div className='position-relative'>
            <input
              type='password'
              name='password'
              className='common-input'
              id='enter-password'
              placeholder='Enter Password'
              required
            />
          </div>
        </div>
        <div className='my-48'>
          <p className='text-gray-500'>
            Your personal data will be used to process your order, support your
            experience throughout this website, and for other purposes described
            in our
            <Link
              href='#'
              className='text-main-600 text-decoration-underline'
            >
              {" "}
              privacy policy
            </Link>
            .
          </p>
        </div>
        <div className='mt-48'>
          <button type='submit' className='btn btn-main py-18 px-40'>
            Register
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegisterForm;
