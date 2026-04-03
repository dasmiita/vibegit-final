import api from './axios';

export const sendRemixRequest = (projectId, message = "Request to remix project") => {
  return api.post(`/projects/${projectId}/remix-request`, { message });
};

export const fetchRemixRequests = (projectId) => {
  return api.get(`/projects/${projectId}/remix-requests`);
};

export const respondToRemixRequest = (projectId, requestId, action) => {
  return api.post(`/projects/${projectId}/respond-remix`, { requestId, action });
};
