# Hexbin Visualizations for Social Media Posts

## Info
Demo app for the FOSS4G 2023 paper: [An application-oriented implementation of hexagonal on-the-fly binning metrics for city-scale georeferenced social media data](https://talks.osgeo.org/foss4g-2023-academic-track/talk/review/LYAPC8RN3WGQTBAPXQSADB3WFQM3JLSU)

- App: https://geo.rocks/hexbins/
- Data: publicly available Instagram data from 2011-2022 (September). 
- Privacy: The dumps under `data` are grouped by Instagram locations. No individual persons or posts can be tracked as HyperLogLog has been used to create thematic sets when mining the data. More info in the paper.

Using [d3-leaflet](https://github.com/bluehalo/leaflet-d3) for hexagonal binning. All relevant d3-Leaflet JS code in [main.js](https://github.com/do-me/hexbins/blob/main/static/assets/main.js)

Implementing functions for following visualization modes:

- absolute 
- relative 
- signed chi

## Examples 
![image](https://user-images.githubusercontent.com/47481567/233142916-a9d46128-68f0-452d-84a9-452873107aa6.png)

![image](https://user-images.githubusercontent.com/47481567/233143189-559c1484-df25-4d5a-bca9-2375c1b9eb56.png)

![image](https://user-images.githubusercontent.com/47481567/233143393-deb4e082-0432-496f-abec-9693c994e4de.png)

![image](https://user-images.githubusercontent.com/47481567/233143679-34f08f09-76ec-4dbc-921b-37e9a76c70a8.png)
