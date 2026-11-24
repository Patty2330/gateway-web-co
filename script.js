(function(){
  var btn=document.querySelector('.menu-btn'),menu=document.getElementById('menu');
  btn.addEventListener('click',function(){var o=menu.classList.toggle('open');btn.setAttribute('aria-expanded',o);});
  menu.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){menu.classList.remove('open');btn.setAttribute('aria-expanded',false);});});
  document.getElementById('yr').textContent=new Date().getFullYear();
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12});
    document.querySelectorAll('.card,.steps li,.concept,details,.why-list').forEach(function(el){el.classList.add('reveal');io.observe(el);});
  }
  var f=document.getElementById('contact-form'),st=f.querySelector('.form-status');
  f.addEventListener('submit',function(e){
    e.preventDefault();var ok=true;
    f.querySelectorAll('[required]').forEach(function(i){var bad=!i.value.trim();i.classList.toggle('invalid',bad);if(bad)ok=false;});
    if(!ok){st.textContent=f.getAttribute('data-error')||'Please fill in your name, business name and a way to reach you.';return;}
    var thanks=f.getAttribute('data-thanks')||'Thanks! Online requests go live once the business email is connected. For now, reach Jalen at [email] or [phone].';
    thanks=thanks.replace('[email]',f.getAttribute('data-email')||'[email]').replace('[phone]',f.getAttribute('data-phone')||'[phone]');
    st.textContent=thanks;
    f.reset();
  });
})();
