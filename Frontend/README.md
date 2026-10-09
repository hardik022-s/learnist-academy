# Learnist Academy

A 100% online exam preparation website for JEE, NEET, CA, UPSC, SSC, Banking, Railways, Defence, Teaching, State PSC, Law and Foundation.

## Run it

Double-click `index.html`. No install or server needed. (Internet is needed only for fonts and photos.)

## Files

| File | What's in it |
|---|---|
| `index.html` | Page shell; loads the other files |
| `style.css` | All styling (colours are variables at the top) |
| `data.js` | Site content: categories, courses, faculty, batches, results, FAQs |
| `app.js` | All logic: pages, routing, login, onboarding, study plan, assistant, admin |

## Demo logins

| Role | Email | Password |
|---|---|---|
| Student | student@learnist.com | Student@123 |
| New student | new@learnist.com | Student@123 |
| Admin | admin@learnist.com | Admin@123 (open `index.html#/admin/login`) |

Phone OTP: `123456`

## Notes

- Logins, bookings and enquiries are saved in the browser (localStorage). This is a frontend demo; a real backend is needed before launch.
- To reset the demo data, run `localStorage.clear()` in the browser console.
