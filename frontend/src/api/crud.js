import api from "./client";

export const crudApi = (path) => ({
    list: (params) => api.get(`/${path}`, { params }).then((res) => res.data),
    create: (payload) =>
        api.post(`/${path}`, payload).then((res) => res.data.data),
    update: (id, payload) =>
        api.put(`/${path}/${id}`, payload).then((res) => res.data.data),
    remove: (id) => api.delete(`/${path}/${id}`),
});
