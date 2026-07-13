"use client";
import { useEffect, useState } from "react";

const Preloader = () => {
  let [active, setActive] = useState(true);
  useEffect(() => {
    setTimeout(function () {
      setActive(false);
    }, 1000);
  }, []);

  return (
    <>
      {active ? (
        <div className='preloader'>
          <img
            src='/assets/images/logo/logo-vertical.png'
            alt='Hot Rod Rigs'
            className='preloader__logo'
          />
        </div>
      ) : (
        <div></div>
      )}
    </>
  );
};

export default Preloader;
