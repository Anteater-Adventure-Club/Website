import Image from "next/image";

/*

function openPopup(personId) {
  const popup = document.getElementById(`popup-${personId}`);
  popup.classList.remove(...popup.classList);
  popup.classList.add('popup');

  const polaroid = document.querySelector(`[onclick="openPopup('${personId}')"]`);
  const styleClass = polaroid.getAttribute('data-popup-style');

  if (styleClass) {
    popup.classList.add(styleClass);
  }

  popup.style.display = "block";
}

function closePopup(id) {
  document.getElementById('popup-' + id).style.display = 'none';
}

window.onclick = function(event) {
  document.querySelectorAll('.popup').forEach(popup => {
    if (event.target === popup) {
      popup.style.display = 'none';
    }
  });
}

*/

export default function Gallery() {
  return (
    <main className="event_gallery-main">
      <h1>Check Out our Previous Events!</h1>

      <div className="polaroid-gallery-events">
        <div className="polaroid-events" data-popup-style="event-style">
          <Image src="../images/AACxUCRBlackStarCanyonFalls.jpg" alt="event" />
          <div className="caption">
            <span className="name-font">AAC x UCR Black Star Canyon Falls</span>
            <br />
            <span className="role-font">May 10, 2025</span>
          </div>
        </div>

        <div id="popup-event" className="popup">
          <div className="popup-content event-style">
            <span className="close">&times;</span>
            <span className="name-font event-name">
              AAC x UCR Black Star Canyon Falls
            </span>
            <br />
            <span className="role-font">May 10, 2025</span>
            <h3>Event Info</h3>
            <p>
              On Saturday AAC went to Black Star Canyon for a collab with UCR’s
              Running Club!
            </p>
          </div>
        </div>
      </div>

      <div className="polaroid-gallery-events">
        <div className="polaroid-events" data-popup-style="event-style">
          <Image src="../images/AACxUCRBlackStarCanyonFalls.jpg" alt="event" />
          <div className="caption">
            <span className="name-font">AAC x UCR Black Star Canyon Falls</span>
            <br />
            <span className="role-font">May 10, 2025</span>
          </div>
        </div>

        <div id="popup-event" className="popup">
          <div className="popup-content event-style">
            <span className="close">&times;</span>
            <span className="name-font event-name">
              AAC x UCR Black Star Canyon Falls
            </span>
            <br />
            <span className="role-font">May 10, 2025</span>
            <h3>Event Info</h3>
            <p>
              On Saturday AAC went to Black Star Canyon for a collab with UCR’s
              Running Club!
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
