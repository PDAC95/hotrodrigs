import React from 'react'

const NewsletterTwo = () => {
    return (
        <div
            className="newsletter-two py-32"
            style={{
                background: "#232326",
                borderTop: "1px solid rgba(250, 100, 0, 0.55)",
                borderBottom: "1px solid rgba(250, 100, 0, 0.55)",
            }}
        >
            <div className="container container-lg">
                <div className="flex-between gap-20 flex-wrap">
                    <div className="flex-align gap-22">
                        <span className="d-flex">
                            <img src="/assets/images/icon/envelop.png" alt="" />
                        </span>
                        <div>
                            <h5 className="text-white mb-12 fw-medium">
                                Join the Hot Rod Rigs Newsletter
                            </h5>
                            <p className="text-white fw-light">
                                New parts, deals and fitment updates, straight to your inbox
                            </p>
                        </div>
                    </div>
                    <form action="#" className="newsletter-two__form w-50">
                        <div className="flex-align gap-16">
                            <input
                                type="text"
                                className="common-input style-two rounded-8 flex-grow-1 py-14"
                                placeholder="Enter your email address"
                            />
                            <button
                                type="submit"
                                className="btn btn-main-two flex-shrink-0 rounded-8 py-16"
                            >
                                {" "}
                                Subscribe
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

    )
}

export default NewsletterTwo