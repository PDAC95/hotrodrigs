import React from "react";

// Server component. Renders the legally-required California Prop 65 warning as a
// VISIBLE bordered callout near the price/add area — never hidden in an accordion or
// specs tab (BRWS-05, CONTEXT locked decision). Renders nothing when not flagged.
const Prop65Warning = ({ show }) => {
  if (!show) return null;

  return (
    <div
      className='mt-24 p-16 rounded-8 border border-warning-600 bg-warning-50 flex-align gap-12 align-items-start'
      role='note'
      aria-label='California Proposition 65 Warning'
    >
      <span className='text-warning-600 text-2xl d-flex flex-shrink-0'>
        <i className='ph-fill ph-warning' />
      </span>
      <div>
        <h6 className='mb-4 text-warning-700 text-md'>
          &#9888; WARNING: California Proposition 65
        </h6>
        <p className='mb-0 text-sm text-gray-700'>
          This product can expose you to chemicals known to the State of
          California to cause cancer and birth defects or other reproductive
          harm. For more information, go to{" "}
          <a
            href='https://www.P65Warnings.ca.gov'
            target='_blank'
            rel='noopener noreferrer'
            className='text-warning-700 fw-medium'
          >
            www.P65Warnings.ca.gov
          </a>
          .
        </p>
      </div>
    </div>
  );
};

export default Prop65Warning;
