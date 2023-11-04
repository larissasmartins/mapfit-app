'use strict';
import { Workout, Walking, Running, Cycling } from './workouts.js';

////////////////////////////////// Application Architecture
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const errorMessage = document.querySelector('.error-message');
const errorMessageClose = document.querySelector('.close');

export class App {
  // Private properties: are going to be present on all the instances created through this class
  #map;
  #mapEvent;
  #workouts = [];
  #mapZoomLevel = 13;

  constructor() {
    // Get users position
    this._getPosition();

    // Get data from local storage
    this._getDataLocalStorage();

    form.addEventListener('submit', this._newWorkout.bind(this));
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));

    errorMessageClose.addEventListener(
      'click',
      this._closeErrorMessage.bind(this)
    );
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        // Using .bind() to point "this" to the current object
        this._loadMap.bind(this),
        function () {
          alert('Could not get position');
        }
      );
    }
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map: to show the form
    this.#map.on('click', this._showForm.bind(this));

    // Render the previous markers on the map when its fully load
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();

    // Add an event listener to the inputType element to handle input switching
    inputType.addEventListener('change', () => {
      const selectedWorkoutType = inputType.value;

      // Show the elevation input field for cycling workouts and switch to cadence for running and walking
      const elevationInputRow = inputElevation.closest('.form__row');
      const cadenceInputRow = inputCadence.closest('.form__row');

      if (selectedWorkoutType === 'cycling') {
        elevationInputRow.classList.remove('form__row--hidden');
        cadenceInputRow.classList.add('form__row--hidden');
      } else if (
        selectedWorkoutType === 'running' ||
        selectedWorkoutType === 'walking'
      ) {
        elevationInputRow.classList.add('form__row--hidden');
        cadenceInputRow.classList.remove('form__row--hidden');
      }
    });
  }

  _hideForm() {
    // Empty inputs
    // prettier-ignore
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';
    form.classList.add('hidden');
  }

  _toggleEvelationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    e.preventDefault();

    // Get data from the form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;

    // Check if the data is valid
    if (
      !this._validateInputs(type, distance, duration) ||
      !this._validatePositivity(type, distance, duration)
    ) {
      // Display error message notification
      this._displayErrorMessage();
      return;
    }

    let workout;

    if (type === 'walking' || type === 'running') {
      const cadence = +inputCadence.value;
      workout =
        type === 'walking'
          ? new Walking([lat, lng], distance, duration, cadence)
          : new Running([lat, lng], distance, duration, cadence);
    } else if (type === 'cycling') {
      const elevation = +inputElevation.value;
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as a marker
    this._renderWorkoutMarker(workout);

    // Render workout on the list
    this._renderWorkout(workout);

    // Hide form and clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _validateInputs(type, distance, duration) {
    return Number.isFinite(distance) && Number.isFinite(duration);
  }

  _validatePositivity(type, distance, duration) {
    if (type === 'walking' || type === 'running') {
      const cadence = +inputCadence.value;
      return distance > 0 && duration > 0 && cadence > 0;
    } else if (type === 'cycling') {
      const elevation = +inputElevation.value;
      return distance > 0 && duration > 0 && elevation > 0;
    }
  }

  _renderWorkoutMarker(workout) {
    // Change leaflet's icon appearance
    let newIcon = L.icon({
      iconUrl: 'img/icon.png',

      iconSize: [40, 40], // size of the icon
      iconAnchor: [22, 80], // point of the icon which will correspond to marker's location
      popupAnchor: [-3, -76], // point from which the popup should open relative to the iconAnchor
    });

    // Display marker
    const marker = L.marker(workout.coords, { icon: newIcon })
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${
          workout.type === 'walking'
            ? '🚶‍♂️'
            : workout.type === 'running'
            ? '🏃‍♂️'
            : '🚴‍♀️'
        } ${workout.description}`
      )
      .openPopup();

    // Store the marker in the workout object
    workout.marker = marker;
  }

  // Workouts list
  _renderWorkout(workout) {
    let html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <a class="workout__delete-button" role="button" aria-label="delete workout">delete</a>
        <h2 class="workout__title">${workout.description}</h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'walking'
                ? '🚶‍♂️'
                : workout.type === 'running'
                ? '🏃‍♂️'
                : '🚴‍♀️'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span> 
            <span class="workout__unit">min</span>
          </div>
      `;

    if (workout.type === 'walking')
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>    
      `;

    if (workout.type === 'running')
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>    
      `;

    if (workout.type === 'cycling')
      html += `
            <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>    
      `;

    form.insertAdjacentHTML('afterend', html);
    errorMessage.style.display = 'none';
  }

  // Handle delete workout
  _deleteWorkout(e) {
    const deleteButton = e.target.closest('.workout__delete-button');

    if (deleteButton) {
      const workoutElement = deleteButton.closest('.workout');
      if (workoutElement) {
        const workoutId = workoutElement.dataset.id;
        this._removeWorkoutUI(workoutElement);
        this._removeWorkoutMarker(workoutId);
        this._removeWorkoutStorage(workoutId);
      }
    }
  }

  _removeWorkoutUI(workoutElement) {
    workoutElement.remove();
  }

  _removeWorkoutMarker(workoutId) {
    const workout = this.#workouts.find(work => work.id === workoutId);
    if (workout && workout.marker) {
      workout.marker.remove();
    }
  }

  _removeWorkoutStorage(workoutId) {
    const workoutIndex = this.#workouts.findIndex(
      workout => workout.id === workoutId
    );

    if (workoutIndex !== -1) {
      this.#workouts.splice(workoutIndex, 1);
      this._setLocalStorage();
    }
  }

  // Move map to the workout marker when clicked
  _moveToPopup(e) {
    const workoutElement = e.target.closest('.workout');
    if (!workoutElement) return;

    const workoutId = workoutElement.dataset.id;
    const workout = this.#workouts.find(work => work.id === workoutId);

    if (workout) {
      const [lat, lng] = workout.coords;
      this.#map.setView([lat, lng], this.#mapZoomLevel, {
        animate: true,
        pan: {
          duration: 1,
        },
      });
    }
  }

  // Saving datas on local storage - array of workout objects containing only the necessary data
  _setLocalStorage() {
    const workoutsToSave = this.#workouts.map(workout => ({
      id: workout.id,
      type: workout.type,
      coords: workout.coords,
      distance: workout.distance,
      duration: workout.duration,
      cadence: workout.cadence,
      speed: workout.speed,
      elevationGain: workout.elevationGain,
    }));

    localStorage.setItem('workouts', JSON.stringify(workoutsToSave));
  }

  _getDataLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;

    this.#workouts = data.map(workoutData => {
      // Create Running or Cycling instances based on the 'type' property.
      if (workoutData.type === 'walking') {
        return new Walking(
          workoutData.coords,
          workoutData.distance,
          workoutData.duration,
          workoutData.cadence
        );
      } else if (workoutData.type === 'running') {
        return new Running(
          workoutData.coords,
          workoutData.distance,
          workoutData.duration,
          workoutData.cadence
        );
      } else {
        return new Cycling(
          workoutData.coords,
          workoutData.distance,
          workoutData.duration,
          workoutData.elevationGain
        );
      }
    });

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  _displayErrorMessage() {
    errorMessage.style.display = 'block';

    setTimeout(() => {
      errorMessage.style.display = 'none';
    }, 3000); // Hide after 3 seconds
  }

  _closeErrorMessage() {
    errorMessage.style.display = 'none';
  }
}
