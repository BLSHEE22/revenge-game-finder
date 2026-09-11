const header = document.querySelector("header");
const sectionOne = document.querySelector(".change-name");

const sectionOneOptions = {
  rootMargin: "-200px 0px 0px 0px"
};

const sectionOneObserver = new IntersectionObserver(function(
  entries,
  sectionOneObserver
) {
  entries.forEach(entry => {
    if (!entry.isIntersecting) {
      header.classList.add("nav-scrolled");
    } else {
      header.classList.remove("nav-scrolled");
    }
  });
},
sectionOneOptions);

sectionOneObserver.observe(sectionOne);

document.addEventListener("click", event => {
  const link = event.target.closest(".back-to-table");
  if (!link) return;

  event.preventDefault();

  const target = document.querySelector(link.getAttribute("href"));
  if (!target) return;

  window.scrollTo({
    top: target.getBoundingClientRect().top + window.scrollY,
    left: 0,
    behavior: "instant"
  });
  history.pushState(null, "", link.getAttribute("href"));
});
