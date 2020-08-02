export const STATE = {};
export const saveUserState = (update = {}) => {
  const { email } = STATE.user;
  const data = JSON.parse(localStorage.getItem('vanhackevents') || '{}');
  data[email] = Object.assign(data[email] || {}, update);
  localStorage.setItem('vanhackevents', JSON.stringify(data));
  STATE.user = data[email];
};
